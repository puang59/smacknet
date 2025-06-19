import { NextResponse } from "next/server";
import fs from "fs";
import { join } from "path";
import { Proxy } from "@/lib/types";

const loadFileLines = (filePath: string) => {
  try {
    return fs
      .readFileSync(filePath, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith("#"));
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return [];
  }
};

export async function GET() {
  try {
    const currentPath = process.cwd();
    const proxiesPath = join(currentPath, "data/proxies.txt");
    const uasPath = join(currentPath, "data/uas.txt");

    // Load user agents
    const userAgents = loadFileLines(uasPath);

    // Load and parse proxies
    const proxyLines = loadFileLines(proxiesPath);
    const proxies: Proxy[] = proxyLines.map((line) => {
      const [protocol, loginInfo] = line.split("://");

      //RegEx for proxies with authentication (protocol://user:pass@host:port)
      const authProxiesRegEx = new RegExp(
        /^(http|https|socks4|socks5|):\/\/(\S+:\S+)@((\w+|\d+\.\d+\.\d+\.\d+):\d+)$/,
        "g"
      );

      if (authProxiesRegEx.test(line)) {
        const [auth, addr] = loginInfo.split("@");
        const [user, pass] = auth.split(":");
        const [host, port] = addr.split(":");

        return {
          protocol,
          host,
          port: parseInt(port),
          username: user,
          password: pass,
        };
      } else {
        const [host, port] = loginInfo.split(":");
        return { protocol, host, port: parseInt(port) };
      }
    });

    return NextResponse.json({ proxies, userAgents });
  } catch (error) {
    console.error("Error loading files:", error);
    return NextResponse.json(
      { error: "Failed to load configuration files" },
      { status: 500 }
    );
  }
}
