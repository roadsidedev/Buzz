import React, { useState, useEffect } from "react";

interface LogEntry {
  timestamp: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
}

const initialLogs: LogEntry[] = [
  { timestamp: "12:44:01", message: "@clawzz-OS initialized...", type: "info" },
  {
    timestamp: "12:44:05",
    message: "Checking agent connections...",
    type: "info",
  },
  {
    timestamp: "12:44:10",
    message: "DEFI_ALPHA is now LIVE.",
    type: "success",
  },
  { timestamp: "12:44:12", message: "12.4k packets received.", type: "info" },
  { timestamp: "12:44:15", message: "Memory heap: 42%", type: "info" },
  {
    timestamp: "12:44:18",
    message: "CRYPTOBOT joined room #420",
    type: "success",
  },
  {
    timestamp: "12:44:22",
    message: "Processing audio stream...",
    type: "info",
  },
  {
    timestamp: "12:44:25",
    message: "TOKENLOGIC is now LIVE.",
    type: "success",
  },
];

const simulatedLogs: LogEntry[] = [
  {
    timestamp: "12:44:28",
    message: "New listener connected: 0x7a2...f9",
    type: "info",
  },
  {
    timestamp: "12:44:31",
    message: "Orchestrator scoring round #142",
    type: "info",
  },
  { timestamp: "12:44:35", message: "TTS latency: 42ms", type: "info" },
  { timestamp: "12:44:38", message: "CHAINANALYST sent message", type: "info" },
  {
    timestamp: "12:44:42",
    message: "Room #420 objective: 65% complete",
    type: "success",
  },
  { timestamp: "12:44:45", message: "Garbage collection: 12ms", type: "info" },
  { timestamp: "12:44:48", message: "Cache hit rate: 94%", type: "info" },
];

interface SystemLogProps {
  className?: string;
}

export const SystemLog: React.FC<SystemLogProps> = ({ className }) => {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);

  useEffect(() => {
    const interval = setInterval(() => {
      setLogs((prev) => {
        const newLog =
          simulatedLogs[Math.floor(Math.random() * simulatedLogs.length)];
        const updatedLog = {
          ...newLog,
          timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
        };
        return [...prev.slice(-20), updatedLog];
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const getTextColor = (type?: LogEntry["type"]) => {
    switch (type) {
      case "success":
        return "text-[#00FF41]";
      case "warning":
        return "text-[#FFE66D]";
      case "error":
        return "text-[#FF6B6B]";
      default:
        return "text-[#00FF41]";
    }
  };

  return (
    <div
      className={`bg-black p-3 space-y-1 font-mono text-[10px] h-[280px] overflow-auto ${className}`}
      style={{ fontFamily: "'Courier New', monospace" }}
    >
      {logs.map((log, index) => (
        <div key={index} className={`${getTextColor(log.type)} opacity-90`}>
          <span className="opacity-60">[{log.timestamp}]</span> {log.message}
        </div>
      ))}
      <div className="text-[#00FF41] animate-pulse">{"> Awaiting input_"}</div>
    </div>
  );
};

export default SystemLog;
