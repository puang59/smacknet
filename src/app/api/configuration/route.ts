import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";

function currentPath() {
  const path = process.cwd();
  return path === "/" ? "." : path;
}

export async function GET() {
  try {
    const proxiesText = readFileSync(
      join(currentPath(), "data", "proxies.txt"),
      "utf-8"
    );
    const uasText = readFileSync(
      join(currentPath(), "data", "uas.txt"),
      "utf-8"
    );

    return NextResponse.json({
      proxies: btoa(proxiesText),
      uas: btoa(uasText),
    });
  } catch (error) {
    console.error("Error reading configuration files:", error);
    return NextResponse.json(
      { error: "Failed to read configuration files" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const proxies = atob(body.proxies);
    const uas = atob(body.uas);

    writeFileSync(join(currentPath(), "data", "proxies.txt"), proxies, {
      encoding: "utf-8",
    });
    writeFileSync(join(currentPath(), "data", "uas.txt"), uas, {
      encoding: "utf-8",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error writing configuration files:", error);
    return NextResponse.json(
      { error: "Failed to write configuration files" },
      { status: 500 }
    );
  }
}
