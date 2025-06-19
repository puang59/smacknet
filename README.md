# smacknet
A lightweight network stress testing tool designed to simulate high traffic scenarios on IPs and domains. it's simple to run locally, easy to configure, and useful for testing server reliability and performance under load.

## Setup

1. Clone the repository:

```bash
git clone https://github.com/puang59/smacknet.git
cd smacknet
```

2. Install dependencies:

```bash
bun install
cd server && bun install && cd ..
```

3. Configure proxy list and user agents:

- Create `data/proxies.txt` with these lines:

```
socks5://127.0.0.1:1081
socks5://localhost:1081
```

- Create `data/uas.txt` with common user agents (one per line):

```
Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0
Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15
```

You can also get more user agents from [user-agents.net](https://user-agents.net/random) or similar sites.

4. Start the local proxy server:

```bash
cd server
bun start
```

Keep this terminal running. The proxy server will start on port 1081.

5. Start the web interface:

```bash
# In a new terminal
cd smacknet  # Go back to project root if needed
bun dev
```

6. Open http://localhost:3000 in your browser

## Usage

1. Enter target URL/IP
2. Configure packet size (1-1500kb)
3. Set duration (1-300 seconds)
4. Adjust packet delay (1-1000ms)
5. Click "Start Attack" to begin testing
