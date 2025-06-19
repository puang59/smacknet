import { NextRequest, NextResponse } from "next/server";
import { SocksProxyAgent } from "socks-proxy-agent";
import axios, { AxiosError } from "axios";
import https from "https";

export async function POST(req: NextRequest) {
  try {
    const { target, proxy, userAgent, method, payload } = await req.json();

    // Create proxy agent if it's a SOCKS proxy
    let agent;
    if (proxy.protocol === "socks4" || proxy.protocol === "socks5") {
      const uri = `${proxy.protocol}://${
        proxy.username && proxy.password
          ? `${proxy.username}:${proxy.password}@`
          : ""
      }${proxy.host}:${proxy.port}`;
      agent = new SocksProxyAgent(uri);
    }

    // Create HTTPS agent that ignores certificate validation
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    });

    // Make the request through the proxy
    const response = await axios({
      method: method,
      url: target,
      headers: {
        "User-Agent": userAgent,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: method === "POST" ? payload : undefined,
      proxy:
        proxy.protocol === "http" || proxy.protocol === "https"
          ? {
              host: proxy.host,
              port: proxy.port,
              auth:
                proxy.username && proxy.password
                  ? { username: proxy.username, password: proxy.password }
                  : undefined,
            }
          : undefined,
      httpAgent: agent || httpsAgent,
      httpsAgent: agent || httpsAgent,
      timeout: 5000,
      validateStatus: (status) => status < 500,
    });

    return NextResponse.json({ success: true, status: response.status });
  } catch (error: unknown) {
    const axiosError = error as AxiosError;
    console.error("Proxy request failed:", axiosError);
    return NextResponse.json(
      { success: false, error: axiosError?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
