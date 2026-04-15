import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(
  _req: NextRequest,
  { params }: { params: { size: string } }
) {
  const size = Math.min(Math.max(parseInt(params.size) || 512, 16), 1024);
  const r    = Math.round(size * 0.18); // border-radius

  return new ImageResponse(
    (
      <div
        style={{
          width:          size,
          height:         size,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          background:     "linear-gradient(135deg, #7131d6 0%, #0058bf 100%)",
          borderRadius:   r,
        }}
      >
        <svg
          width={size * 0.56}
          height={size * 0.56}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* D — vertical stroke */}
          <rect x="1.5" y="3" width="2.5" height="18" rx="1.2" fill="white" />
          {/* D — curved bowl */}
          <path
            d="M 4 3 L 7 3 C 12.5 3 12.5 21 7 21 L 4 21 Z"
            fill="white"
          />
          {/* H — left vertical */}
          <rect x="13"  y="3" width="2.5" height="18" rx="1.2" fill="white" />
          {/* H — right vertical */}
          <rect x="18.5" y="3" width="2.5" height="18" rx="1.2" fill="white" />
          {/* H — crossbar */}
          <rect x="13" y="10.5" width="8" height="3" rx="1.2" fill="white" />
        </svg>
      </div>
    ),
    { width: size, height: size }
  );
}
