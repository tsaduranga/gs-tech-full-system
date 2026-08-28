import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          borderRadius: 6,
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#2563eb",
            fontFamily: "Arial, sans-serif",
            lineHeight: 1,
            marginTop: -1,
          }}
        >
          G
        </span>
      </div>
    ),
    {
      ...size,
    }
  );
}
