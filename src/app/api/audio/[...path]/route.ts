import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const filePath = segments.join("/");

  // Validate: only allow alphanumeric, hyphens, dots, and forward slashes
  if (!/^[a-zA-Z0-9\-/.]+\.mp3$/.test(filePath)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  // Prevent directory traversal
  if (filePath.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const fullPath = path.join(process.cwd(), "public", "audio", filePath);

  try {
    const buffer = await readFile(fullPath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
