import React from "react";
import { useMeasuring } from "../../hooks";

const MeasureButton: React.FC = () => {
  const { isMeasuring, toggleMeasuring, loading } = useMeasuring();
  return (
    <div className="flex justify-center hover:scale-105 transition-all active:scale-95">
      <button
        onClick={toggleMeasuring}
        disabled={loading}
        className={`relative inline-flex h-10 w-32 overflow-hidden rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/60 ${
          isMeasuring ? "p-[2px]" : "p-[1px]"
        } ${
          isMeasuring
            ? "shadow-[0_0_12px_rgba(160,124,239,0.2),0_0_20px_rgba(255,112,155,0.15)]"
            : "shadow-small"
        } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {isMeasuring ? (
          <>
            {/* Gradient outline - visible in the 2px padding */}
            <span
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, #a07cef 0%, #ff709b 100%)",
              }}
            />
            {/* Dark base */}
            <span
              className="absolute inset-[2px] rounded-full bg-[#19141c]/70"
            />
            {/* Gradient tint overlay */}
            <span
              className="absolute inset-[2px] rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, rgba(160,124,239,0.25) 0%, rgba(255,112,155,0.25) 100%)",
              }}
            />
          </>
        ) : (
          <span className="absolute inset-0 bg-[linear-gradient(45deg,#A07CEF_0%,#A07CEF_60%,#FF709B_100%)] opacity-25" />
        )}
        <span
          className={`relative inline-flex h-full w-full items-center justify-center rounded-full px-4 py-1 text-sm backdrop-blur-sm transition-all duration-300 ${
            isMeasuring
              ? "bg-transparent text-white"
              : "bg-content1 text-foreground border border-white/10 hover:border-primary/30"
          }`}
        >
          {loading ? (
            <>
              <div className="w-3 h-3 bg-warning-400 rounded-full mr-2 shrink-0"></div>
              Loading...
            </>
          ) : isMeasuring ? (
            <>
              <div className="w-3 h-3 bg-[#ff709b] rounded-full mr-2.5 shrink-0 animate-pulse" />
              TRACKING
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-secondary rounded-full mr-2 shrink-0"></div>
              START
            </>
          )}
        </span>
      </button>
    </div>
  );
};

export default MeasureButton;
