import { useState, useEffect } from "react";

/**
 * Enumerates available media devices.
 * Re-enumerates whenever a device is added/removed.
 */
export function useDevices() {
  const [cameras, setCameras] = useState([]);
  const [microphones, setMicrophones] = useState([]);

  async function enumerate() {
    try {
      // Request permission first so labels are populated
      await navigator.mediaDevices
        .getUserMedia({ audio: true, video: true })
        .then((s) => s.getTracks().forEach((t) => t.stop()))
        .catch(() => {});

      const devices = await navigator.mediaDevices.enumerateDevices();

      setCameras(
        devices
          .filter((d) => d.kind === "videoinput")
          .map((d) => ({ id: d.deviceId, name: d.label || d.deviceId }))
      );

      setMicrophones(
        devices
          .filter((d) => d.kind === "audioinput")
          .map((d) => ({ id: d.deviceId, name: d.label || d.deviceId }))
      );
    } catch (err) {
      console.error("[useDevices]", err);
    }
  }

  useEffect(() => {
    enumerate();
    navigator.mediaDevices.addEventListener("devicechange", enumerate);
    return () => navigator.mediaDevices.removeEventListener("devicechange", enumerate);
  }, []);

  return { cameras, microphones };
}
