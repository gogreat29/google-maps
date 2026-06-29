import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        message: "GOOGLE_MAPS_API_KEY가 설정되지 않았습니다."
      },
      { status: 500 }
    );
  }

  try {
    const { lat, lng } = await request.json();
    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ ok: false, message: "위도와 경도 값이 올바르지 않습니다." }, { status: 400 });
    }

    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${lat},${lng}`);
    url.searchParams.set("language", "ko");
    url.searchParams.set("result_type", "sublocality|locality|street_address|premise");
    url.searchParams.set("key", apiKey);

    const response = await fetch(url);
    const data = await response.json();
    if (data.status !== "OK") {
      return NextResponse.json({ ok: false, message: data.error_message || `Reverse Geocoding 실패: ${data.status}` }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      label: data.results?.[0]?.formatted_address || `${lat}, ${lng}`,
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
