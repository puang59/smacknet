import axios, { AxiosRequestConfig } from "axios";
import net from "net";
import { SocksProxyAgent } from "socks-proxy-agent";
import { Proxy } from "../types";

interface HttpClientConfig extends AxiosRequestConfig {
  proxy?: Proxy;
}

interface SocketConfig {
  host: string;
  port: number;
  timeout: number;
}

interface ExtendedSocket extends net.Socket {
  open?: boolean;
}

// Misc
export function createAgent(proxy: Proxy) {
  if (proxy.protocol !== "socks4" && proxy.protocol !== "socks5") {
    throw new Error("Unsupported proxy protocol for agent: " + proxy.protocol);
  }

  const uri = `${proxy.protocol}://${
    proxy.username && proxy.password
      ? `${proxy.username}:${proxy.password}@`
      : ""
  }${proxy.host}:${proxy.port}`;

  return new SocksProxyAgent(uri);
}

// HTTP Client
export function createMimicHttpClient(proxy: Proxy, userAgent: string) {
  return createHttpClient({
    headers: { "User-Agent": userAgent },
    proxy,
    timeout: 5000,
    validateStatus: (status: number) => {
      return status < 500;
    },
    maxRedirects: 3,
  });
}

export function createHttpClient(
  clientConfig: HttpClientConfig = {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36",
    },
    timeout: 5000,
    validateStatus: (status: number) => {
      return status < 500;
    },
    maxRedirects: 0,
  }
) {
  const config: AxiosRequestConfig = { ...clientConfig };
  const proxy = clientConfig.proxy;

  if (proxy && (proxy.protocol == "http" || proxy.protocol == "https")) {
    config.proxy = {
      host: proxy.host,
      port: proxy.port,
      auth:
        proxy.username && proxy.password
          ? { username: proxy.username, password: proxy.password }
          : undefined,
    };
  } else if (
    proxy &&
    (proxy.protocol == "socks4" || proxy.protocol == "socks5")
  ) {
    const agent = createAgent(proxy);
    config.proxy = false;
    config.httpAgent = agent;
    config.httpsAgent = agent;
  } else if (proxy) {
    throw new Error(
      "Unsupported proxy protocol for HTTP client: " + proxy.protocol
    );
  }

  const client = axios.create(config);
  return client;
}

// TCP Client
const DEFAULT_SOCKET_CONFIG: SocketConfig = {
  host: "127.0.0.1",
  port: 1080,
  timeout: 5000,
};

export function createTcpClient(
  proxy: Proxy,
  socketConfig: SocketConfig = DEFAULT_SOCKET_CONFIG,
  callback?: (socket: ExtendedSocket) => void
) {
  if (proxy.protocol !== "socks4" && proxy.protocol !== "socks5") {
    throw new Error(
      "Unsupported proxy protocol for TCP client: " + proxy.protocol
    );
  }

  const socket = new net.Socket() as ExtendedSocket;
  const config = { ...DEFAULT_SOCKET_CONFIG, ...socketConfig };

  socket.setTimeout(config.timeout);

  socket.connect(
    {
      host: config.host,
      port: config.port,
    },
    () => {
      if (callback) callback(socket);
      socket.open = true;
    }
  );

  socket.on("close", () => {
    socket.open = false;
  });

  socket.on("timeout", () => {
    socket.destroy();
    socket.open = false;
  });

  return socket;
}
