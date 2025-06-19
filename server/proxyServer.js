import net from "net";
import cluster from "cluster";
import { cpus } from "os";

const numCPUs = cpus().length;
const PROXY_PORT = process.env.PORT || 1081;
const PROXY_HOST = "0.0.0.0";

if (cluster.isPrimary) {
  console.log(`Master process running on PID ${process.pid}`);

  // Fork workers for each CPU core
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.log(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  const server = net.createServer((clientSocket) => {
    clientSocket.once("data", (data) => {
      // Parse the SOCKS5 handshake
      if (data[0] !== 0x05) {
        // SOCKS5 version
        clientSocket.end();
        return;
      }

      // Send auth method choice (no auth required)
      clientSocket.write(Buffer.from([0x05, 0x00]));

      // Handle the connection request
      clientSocket.once("data", (data) => {
        if (data[0] !== 0x05) {
          // SOCKS5 version
          clientSocket.end();
          return;
        }

        const cmd = data[1];
        if (cmd !== 0x01) {
          // Only support CONNECT method
          clientSocket.end(
            Buffer.from([0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
          );
          return;
        }

        // Parse address
        let atyp = data[3];
        let addr, port;
        if (atyp === 0x01) {
          // IPv4
          addr = `${data[4]}.${data[5]}.${data[6]}.${data[7]}`;
          port = data.readUInt16BE(8);
        } else if (atyp === 0x03) {
          // Domain name
          const addrLen = data[4];
          addr = data.slice(5, 5 + addrLen).toString();
          port = data.readUInt16BE(5 + addrLen);
        } else {
          clientSocket.end(
            Buffer.from([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
          );
          return;
        }

        console.log(`[${process.pid}] Connecting to ${addr}:${port}`);

        // Connect to target
        const targetSocket = net.createConnection(port, addr, () => {
          // Send success response
          clientSocket.write(
            Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
          );

          // Start proxying data
          targetSocket.pipe(clientSocket);
          clientSocket.pipe(targetSocket);
        });

        targetSocket.on("error", (err) => {
          console.error(
            `[${process.pid}] Target connection error:`,
            err.message
          );
          clientSocket.end();
        });

        clientSocket.on("error", (err) => {
          console.error(
            `[${process.pid}] Client connection error:`,
            err.message
          );
          targetSocket.end();
        });

        // Log data transfer
        let bytesTransferred = 0;
        clientSocket.on("data", (chunk) => {
          bytesTransferred += chunk.length;
          console.log(
            `[${process.pid}] Data transfer: ${chunk.length} bytes (Total: ${bytesTransferred})`
          );
        });
      });
    });
  });

  // Handle server errors
  server.on("error", (err) => {
    console.error(`[${process.pid}] Server error:`, err);
  });

  // Start listening
  server.listen(PROXY_PORT, PROXY_HOST, () => {
    console.log(
      `[${process.pid}] SOCKS5 proxy server running on ${PROXY_HOST}:${PROXY_PORT}`
    );
  });

  // Handle process signals
  process.on("SIGTERM", () => {
    console.log(`[${process.pid}] Received SIGTERM. Closing server...`);
    server.close(() => {
      process.exit(0);
    });
  });
}
