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

3. Configure user agents:

Some user agents are already included in `data/uas.txt`, but you can get more from [user-agents.net](https://user-agents.net/random) or similar sites.

4. Start the local proxy server:

```bash
cd server
bun start
```

Keep this terminal running. The proxy servers will start on ports 1081-1084.

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
