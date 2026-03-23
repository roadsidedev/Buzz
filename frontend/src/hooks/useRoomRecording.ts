/**
 * useRoomRecording Hook
 *
 * Records all audio in the room by mixing the local microphone stream with
 * all <audio> elements currently playing (remote peers via jam-core) using
 * the Web Audio API, then capturing the mix with MediaRecorder.
 */

import { useRef, useState, useCallback } from "react"

export interface UseRoomRecordingReturn {
  isRecording: boolean
  startRecording: () => Promise<void>
  stopRecording: () => void
  recordingUrl: string | null
  downloadRecording: (filename?: string) => void
  clearRecording: () => void
  error: string | null
}

export function useRoomRecording(): UseRoomRecordingReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const micStreamRef = useRef<MediaStream | null>(null)

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      // Acquire local microphone
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      micStreamRef.current = micStream

      const audioCtx = new AudioContext()
      audioContextRef.current = audioCtx
      const destination = audioCtx.createMediaStreamDestination()

      // Connect local mic to mix
      const micSource = audioCtx.createMediaStreamSource(micStream)
      micSource.connect(destination)

      // Connect all <audio> elements (remote peers rendered by jam-core)
      const audioElements = Array.from(document.querySelectorAll<HTMLAudioElement>("audio"))
      for (const el of audioElements) {
        try {
          const src = audioCtx.createMediaElementSource(el)
          src.connect(destination)
          // Re-connect to speakers so playback continues
          src.connect(audioCtx.destination)
        } catch {
          // Element may already be connected to a different context — skip
        }
      }

      // Start recording the mixed stream
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm"

      chunksRef.current = []
      const recorder = new MediaRecorder(destination.stream, { mimeType })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const url = URL.createObjectURL(blob)
        setRecordingUrl(prev => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
      }

      recorder.start(1000) // collect chunks every second
      setIsRecording(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start recording"
      setError(msg)
      // Cleanup on failure
      micStreamRef.current?.getTracks().forEach(t => t.stop())
      audioContextRef.current?.close()
      micStreamRef.current = null
      audioContextRef.current = null
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    audioContextRef.current?.close()
    micStreamRef.current = null
    audioContextRef.current = null
    mediaRecorderRef.current = null
    setIsRecording(false)
  }, [])

  const downloadRecording = useCallback((filename = "room-recording.webm") => {
    if (!recordingUrl) return
    const a = document.createElement("a")
    a.href = recordingUrl
    a.download = filename
    a.click()
  }, [recordingUrl])

  const clearRecording = useCallback(() => {
    if (recordingUrl) URL.revokeObjectURL(recordingUrl)
    setRecordingUrl(null)
    setError(null)
  }, [recordingUrl])

  return {
    isRecording,
    startRecording,
    stopRecording,
    recordingUrl,
    downloadRecording,
    clearRecording,
    error,
  }
}

export default useRoomRecording
