import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { lat, lng } = await request.json();
    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ ok: false, message: "위도와 경도 값이 올바르지 않습니다." }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      lat,
      lng
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "현재 위치 주소 변환 중 오류가 발생했습니다."
      },
      { status: 502 }
    );
  }
}
