import { Router } from "express";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { HttpError } from "../utils/httpError.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { authModel } from "../models/authModel.js";
import { userModel } from "../models/userModel.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = z
      .object({
        username: z.string().min(1),
        password: z.string().min(1),
      })
      .parse(req.body);

    const u = await userModel.findByUsername(body.username);
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      req.socket.remoteAddress ??
      null;
    const ua = req.headers["user-agent"] ?? null;

    if (!u || !(await userModel.verifyPassword(u.password_hash, body.password))) {
      await authModel.addLoginHistory({
        userId: u?.id ?? null,
        ip,
        userAgent: ua,
        success: false,
        message: "bad_credentials",
      });
      throw new HttpError(401, "Invalid username or password");
    }
    if (!u.is_active) {
      await authModel.addLoginHistory({
        userId: u.id,
        ip,
        userAgent: ua,
        success: false,
        message: "inactive",
      });
      throw new HttpError(403, "Account disabled");
    }

    const accessToken = signAccessToken({ sub: u.id, username: u.username });
    const { token: refreshToken, jti } = signRefreshToken(u.id);
    await authModel.createRefreshSession(u.id, jti);

    await authModel.addLoginHistory({
      userId: u.id,
      ip,
      userAgent: ua,
      success: true,
    });

    res.json({ accessToken, refreshToken, user: { id: u.id, username: u.username } });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const body = z.object({ refreshToken: z.string().min(10) }).parse(req.body);
    let payload;
    try {
      payload = verifyRefreshToken(body.refreshToken);
    } catch {
      throw new HttpError(401, "Invalid refresh token");
    }
    const ok = await authModel.findValidRefresh(payload.sub, payload.jti);
    if (!ok) throw new HttpError(401, "Refresh token revoked or expired");

    const u = await userModel.findById(payload.sub);
    if (!u || !u.is_active) throw new HttpError(401, "User not found");

    await authModel.revokeRefresh(payload.sub, payload.jti);
    const accessToken = signAccessToken({ sub: u.id, username: u.username });
    const { token: refreshToken, jti } = signRefreshToken(u.id);
    await authModel.createRefreshSession(u.id, jti);

    res.json({ accessToken, refreshToken });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/logout", requireAuth, async (req, res, next) => {
  try {
    const body = z.object({ refreshToken: z.string().optional() }).parse(req.body ?? {});
    if (body.refreshToken) {
      try {
        const p = verifyRefreshToken(body.refreshToken);
        await authModel.revokeRefresh(p.sub, p.jti);
      } catch {
        /* ignore */
      }
    } else {
      await authModel.revokeAllForUser(req.authUser!.id);
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/password-reset/request", async (req, res, next) => {
  try {
    const body = z.object({ email: z.string().email() }).parse(req.body);
    const u = await userModel.findByEmail(body.email);
    /** Do not leak whether email exists */
    if (u) {
      const token = randomUUID() + randomUUID();
      const hash = createHash("sha256").update(token).digest("hex");
      await authModel.createPasswordResetToken(u.id, hash, 60);
      if (envIsDev()) {
        console.log(`[dev] password reset token for ${body.email}: ${token}`);
      }
    }
    res.json({ ok: true, message: "If the email exists, reset instructions were issued." });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/password-reset/confirm", async (req, res, next) => {
  try {
    const body = z
      .object({
        token: z.string().min(10),
        newPassword: z.string().min(8),
      })
      .parse(req.body);
    const hash = createHash("sha256").update(body.token).digest("hex");
    const userId = await authModel.consumePasswordReset(hash);
    if (!userId) throw new HttpError(400, "Invalid or expired token");
    await userModel.update(userId, { password: body.newPassword });
    await authModel.revokeAllForUser(userId);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

function envIsDev() {
  return process.env.NODE_ENV !== "production";
}
