'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Howl } from 'howler'
import { useTheme } from './ThemeProvider'

type SoundType = 'brown' | 'white' | 'pink' | 'rain' | 'forest' | 'ocean' | 'cafe' | null

interface SoundOption {
  id: SoundType
  name: string
  type: 'generated' | 'audio'
  urls?: string[]
}

const SOUNDS: SoundOption[] = [
  { id: 'brown', name: 'Brown', type: 'generated' },
  { id: 'white', name: 'White', type: 'generated' },
  { id: 'pink', name: 'Pink', type: 'generated' },
  {
    id: 'rain',
    name: 'Rain',
    type: 'audio',
    urls: [
      'https://assets.mixkit.co/active_storage/sfx/2432/2432-preview.mp3',
    ]
  },
  {
    id: 'forest',
    name: 'Forest',
    type: 'audio',
    urls: [
      'https://assets.mixkit.co/active_storage/sfx/2438/2438-preview.mp3',
    ]
  },
  {
    id: 'ocean',
    name: 'Ocean',
    type: 'audio',
    urls: [
      'https://assets.mixkit.co/active_storage/sfx/2515/2515-preview.mp3',
    ]
  },
  {
    id: 'cafe',
    name: 'Cafe',
    type: 'audio',
    urls: [
      'https://assets.mixkit.co/active_storage/sfx/2502/2502-preview.mp3',
    ]
  },
]

// SVG Icons
const Icons = {
  headphones: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  ),
  play: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  pause: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  ),
  volumeLow: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  ),
  volumeHigh: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  ),
  waves: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12c.6-.6 1.4-1 2.5-1 2.2 0 2.2 2 4.5 2s2.2-2 4.5-2 2.2 2 4.5 2c1.1 0 1.9-.4 2.5-1" />
      <path d="M2 7c.6-.6 1.4-1 2.5-1 2.2 0 2.2 2 4.5 2s2.2-2 4.5-2 2.2 2 4.5 2c1.1 0 1.9-.4 2.5-1" />
      <path d="M2 17c.6-.6 1.4-1 2.5-1 2.2 0 2.2 2 4.5 2s2.2-2 4.5-2 2.2 2 4.5 2c1.1 0 1.9-.4 2.5-1" />
    </svg>
  ),
  droplet: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  ),
  tree: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22v-7" />
      <path d="M9 22h6" />
      <path d="M12 15l-4-4 2 0-3-3 2 0-3-4h12l-3 4 2 0-3 3 2 0z" />
    </svg>
  ),
  ocean: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.4 2 5 2c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.4 2 5 2c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </svg>
  ),
  coffee: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <line x1="6" y1="2" x2="6" y2="4" />
      <line x1="10" y1="2" x2="10" y2="4" />
      <line x1="14" y1="2" x2="14" y2="4" />
    </svg>
  ),
  grip: (
    <svg width="24" height="8" viewBox="0 0 24 8" fill="currentColor" opacity="0.3">
      <circle cx="4" cy="4" r="1.5" />
      <circle cx="9" cy="4" r="1.5" />
      <circle cx="14" cy="4" r="1.5" />
      <circle cx="19" cy="4" r="1.5" />
    </svg>
  ),
}

const getSoundIcon = (id: SoundType) => {
  switch (id) {
    case 'brown':
    case 'white':
    case 'pink':
      return Icons.waves
    case 'rain':
      return Icons.droplet
    case 'forest':
      return Icons.tree
    case 'ocean':
      return Icons.ocean
    case 'cafe':
      return Icons.coffee
    default:
      return Icons.waves
  }
}

export default function AmbientPlayer() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [isExpanded, setIsExpanded] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentSound, setCurrentSound] = useState<SoundType>(null)
  const [volume, setVolume] = useState(50)
  const [isLoaded, setIsLoaded] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [position, setPosition] = useState({ x: 16, y: 16 })
  const [isDragging, setIsDragging] = useState(false)

  // Howler.js ref for file-based sounds
  const howlRef = useRef<Howl | null>(null)

  // Web Audio API refs for generated noise
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 })

  // ============================================================
  // STOP ALL AUDIO - Howler + Web Audio
  // ============================================================
  const stopAllAudio = useCallback(() => {
    console.log('[AmbientPlayer] stopAllAudio called')

    // Stop Howler.js sound
    if (howlRef.current) {
      console.log('[AmbientPlayer] Stopping Howler sound')
      howlRef.current.stop()
      howlRef.current.unload()
      howlRef.current = null
    }

    // Stop Web Audio API
    if (sourceNodeRef.current) {
      console.log('[AmbientPlayer] Stopping Web Audio source')
      try { sourceNodeRef.current.stop() } catch {}
      try { sourceNodeRef.current.disconnect() } catch {}
      sourceNodeRef.current = null
    }

    if (gainNodeRef.current) {
      try { gainNodeRef.current.disconnect() } catch {}
      gainNodeRef.current = null
    }

    if (audioContextRef.current) {
      console.log('[AmbientPlayer] Closing AudioContext')
      try { audioContextRef.current.close() } catch {}
      audioContextRef.current = null
    }

    setAudioError(null)
  }, [])

  // ============================================================
  // NOISE GENERATION (Web Audio API)
  // ============================================================
  const createNoiseBuffer = useCallback((type: 'brown' | 'white' | 'pink', ctx: AudioContext) => {
    const bufferSize = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      let lastOut = 0
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1

        if (type === 'white') {
          data[i] = white * 0.5
        } else if (type === 'brown') {
          lastOut = (lastOut + (0.02 * white)) / 1.02
          data[i] = lastOut * 3.5
        } else if (type === 'pink') {
          b0 = 0.99886 * b0 + white * 0.0555179
          b1 = 0.99332 * b1 + white * 0.0750759
          b2 = 0.96900 * b2 + white * 0.1538520
          b3 = 0.86650 * b3 + white * 0.3104856
          b4 = 0.55000 * b4 + white * 0.5329522
          b5 = -0.7616 * b5 - white * 0.0168980
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
          b6 = white * 0.115926
        }
      }
    }
    return buffer
  }, [])

  const playGeneratedNoise = useCallback((type: 'brown' | 'white' | 'pink', vol: number) => {
    console.log(`[AmbientPlayer] playGeneratedNoise: ${type} at volume ${vol}`)
    stopAllAudio()

    setTimeout(() => {
      try {
        console.log(`[AmbientPlayer] Creating AudioContext for ${type}`)
        const ctx = new AudioContext()
        audioContextRef.current = ctx

        const gain = ctx.createGain()
        gain.gain.value = vol / 100
        gain.connect(ctx.destination)
        gainNodeRef.current = gain

        const buffer = createNoiseBuffer(type, ctx)
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.loop = true
        source.connect(gain)
        source.start()
        sourceNodeRef.current = source
        console.log(`[AmbientPlayer] ✓ ${type} noise started successfully`)
      } catch (e) {
        console.error('[AmbientPlayer] ✗ Failed to play generated noise:', e)
        setAudioError('Audio failed')
      }
    }, 50)
  }, [stopAllAudio, createNoiseBuffer])

  // ============================================================
  // PLAY FILE-BASED SOUND (Howler.js)
  // ============================================================
  const playHowlerSound = useCallback((sound: SoundOption, vol: number) => {
    console.log(`[AmbientPlayer] playHowlerSound: ${sound.name} at volume ${vol}`)
    console.log(`[AmbientPlayer] URLs:`, sound.urls)
    stopAllAudio()

    if (!sound.urls || sound.urls.length === 0) {
      console.error(`[AmbientPlayer] ✗ No URLs for ${sound.name}`)
      setAudioError(`${sound.name} unavailable`)
      setIsPlaying(false)
      return
    }

    setTimeout(() => {
      console.log(`[AmbientPlayer] Creating Howl for ${sound.name}`)
      howlRef.current = new Howl({
        src: sound.urls!,
        loop: true,
        volume: vol / 100,
        html5: true,
        onload: () => {
          console.log(`[AmbientPlayer] ✓ ${sound.name} loaded successfully`)
        },
        onplay: () => {
          console.log(`[AmbientPlayer] ✓ ${sound.name} playing`)
        },
        onloaderror: (_id, error) => {
          console.error(`[AmbientPlayer] ✗ ${sound.name} load error:`, error)
          setAudioError(`${sound.name} failed to load`)
          setIsPlaying(false)
        },
        onplayerror: (_id, error) => {
          console.error(`[AmbientPlayer] ✗ ${sound.name} play error:`, error)
          setAudioError(`${sound.name} playback error`)
          setIsPlaying(false)
        }
      })

      howlRef.current.play()
    }, 50)
  }, [stopAllAudio])

  // ============================================================
  // START SOUND - Main entry point
  // ============================================================
  const startSound = useCallback((soundId: SoundType, vol: number) => {
    if (!soundId) return

    const sound = SOUNDS.find(s => s.id === soundId)
    if (!sound) return

    if (sound.type === 'generated') {
      playGeneratedNoise(soundId as 'brown' | 'white' | 'pink', vol)
    } else {
      playHowlerSound(sound, vol)
    }
  }, [playGeneratedNoise, playHowlerSound])

  // ============================================================
  // LOAD/SAVE PREFERENCES
  // ============================================================
  useEffect(() => {
    const savedSound = localStorage.getItem('ambient-sound') as SoundType
    const savedVolume = localStorage.getItem('ambient-volume')
    const wasPlaying = localStorage.getItem('ambient-playing') === 'true'
    const savedPosition = localStorage.getItem('ambient-position')

    if (savedSound) setCurrentSound(savedSound)
    if (savedVolume) setVolume(parseInt(savedVolume))
    if (savedPosition) {
      try {
        setPosition(JSON.parse(savedPosition))
      } catch {
        // Use default
      }
    }

    setIsLoaded(true)

    // Auto-resume
    if (wasPlaying && savedSound) {
      setTimeout(() => {
        setIsPlaying(true)
      }, 200)
    }

    // Cleanup on unmount
    return () => {
      stopAllAudio()
    }
  }, [stopAllAudio])

  // Save preferences
  useEffect(() => {
    if (!isLoaded) return
    if (currentSound) localStorage.setItem('ambient-sound', currentSound)
    localStorage.setItem('ambient-volume', volume.toString())
    localStorage.setItem('ambient-playing', isPlaying.toString())
  }, [currentSound, volume, isPlaying, isLoaded])

  useEffect(() => {
    if (!isLoaded) return
    localStorage.setItem('ambient-position', JSON.stringify(position))
  }, [position, isLoaded])

  // ============================================================
  // REACT TO PLAY STATE CHANGES
  // ============================================================
  useEffect(() => {
    if (!isLoaded) return

    console.log(`[AmbientPlayer] Play state effect: isPlaying=${isPlaying}, currentSound=${currentSound}`)

    if (isPlaying && currentSound) {
      startSound(currentSound, volume)
    } else {
      stopAllAudio()
    }
    // Note: volume intentionally excluded - handled by separate volume effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentSound, isLoaded, startSound, stopAllAudio])

  // Update volume live
  useEffect(() => {
    // Howler volume
    if (howlRef.current) {
      howlRef.current.volume(volume / 100)
    }
    // Web Audio volume
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume / 100
    }
  }, [volume])

  // ============================================================
  // DRAG HANDLERS
  // ============================================================
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return

    setIsDragging(true)
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    dragStartRef.current = {
      x: clientX,
      y: clientY,
      posX: position.x,
      posY: position.y,
    }
  }, [position])

  useEffect(() => {
    if (!isDragging) return

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

      const deltaX = dragStartRef.current.x - clientX
      const deltaY = dragStartRef.current.y - clientY

      const newX = Math.max(16, Math.min(window.innerWidth - 80, dragStartRef.current.posX + deltaX))
      const newY = Math.max(16, Math.min(window.innerHeight - 80, dragStartRef.current.posY + deltaY))

      setPosition({ x: newX, y: newY })
    }

    const handleEnd = () => setIsDragging(false)

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleEnd)
    window.addEventListener('touchmove', handleMove)
    window.addEventListener('touchend', handleEnd)

    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleEnd)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', handleEnd)
    }
  }, [isDragging])

  // ============================================================
  // USER ACTIONS
  // ============================================================
  const handleSoundSelect = (soundId: SoundType) => {
    console.log(`[AmbientPlayer] handleSoundSelect: ${soundId} (current: ${currentSound}, isPlaying: ${isPlaying})`)
    stopAllAudio()

    if (currentSound === soundId && isPlaying) {
      console.log(`[AmbientPlayer] Same sound clicked, stopping`)
      setIsPlaying(false)
      setCurrentSound(null)
    } else {
      console.log(`[AmbientPlayer] Switching to ${soundId}`)
      setCurrentSound(soundId)
      setIsPlaying(true)
    }
  }

  const togglePlay = () => {
    console.log(`[AmbientPlayer] togglePlay (isPlaying: ${isPlaying}, currentSound: ${currentSound})`)
    if (isPlaying) {
      stopAllAudio()
      setIsPlaying(false)
    } else {
      if (!currentSound) {
        setCurrentSound('brown')
      }
      setIsPlaying(true)
    }
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div
      ref={containerRef}
      className="fixed z-50"
      style={{
        right: `${position.x}px`,
        bottom: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      {/* Expanded Panel */}
      <div
        className={`
          absolute bottom-full right-0 mb-3
          overflow-hidden
          transition-all duration-300 ease-out origin-bottom-right
          ${isExpanded ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2 pointer-events-none'}
        `}
        style={{
          width: '400px',
          borderRadius: '28px',
          background: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(253, 252, 250, 0.95)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(91, 123, 140, 0.12)',
          boxShadow: isDark
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05) inset'
            : '0 25px 50px -12px rgba(139, 91, 165, 0.12), 0 8px 24px rgba(91, 123, 140, 0.08)'
        }}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-4 cursor-grab active:cursor-grabbing">
          {Icons.grip}
        </div>

        {/* Content */}
        <div className="px-8 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <span className={`text-xs font-medium uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
              Focus Sounds
            </span>
            {isPlaying && (
              <span className="flex items-center gap-2 text-xs text-emerald-500">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Playing
              </span>
            )}
          </div>

          {/* Error message */}
          {audioError && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
              {audioError}
            </div>
          )}

          {/* Sound Grid */}
          <div className="grid grid-cols-4 gap-5 mb-8">
            {SOUNDS.map((sound) => (
              <button
                key={sound.id}
                onClick={() => handleSoundSelect(sound.id)}
                className={`
                  group flex flex-col items-center justify-center py-5 px-3 rounded-2xl
                  transition-all duration-200
                  ${currentSound === sound.id && isPlaying
                    ? 'bg-emerald-500/15 text-emerald-500 ring-2 ring-emerald-500/30 ring-offset-2 ring-offset-transparent'
                    : isDark
                      ? 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-violet-50/50'
                  }
                `}
                title={sound.name}
              >
                <span className="transition-transform duration-200 group-hover:scale-110">
                  {getSoundIcon(sound.id)}
                </span>
                <span className="text-[10px] mt-3 font-medium tracking-wide opacity-60">
                  {sound.name}
                </span>
              </button>
            ))}
          </div>

          {/* Volume Slider */}
          <div className="pt-4 flex items-center gap-5">
            <span className={isDark ? 'text-zinc-600' : 'text-slate-400'}>{Icons.volumeLow}</span>
            <div className="flex-1 relative h-10 flex items-center">
              <div className={`absolute inset-x-0 h-1.5 rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
              <div
                className="absolute left-0 h-1.5 bg-gradient-to-r from-emerald-500/60 to-emerald-400 rounded-full transition-all"
                style={{ width: `${volume}%` }}
              />
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
              />
              <div
                className="absolute w-5 h-5 bg-white rounded-full shadow-lg shadow-black/40 transition-all pointer-events-none"
                style={{ left: `calc(${volume}% - 10px)` }}
              />
            </div>
            <span className={isDark ? 'text-zinc-600' : 'text-slate-400'}>{Icons.volumeHigh}</span>
          </div>
        </div>
      </div>

      {/* Main Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        className={`
          relative flex items-center justify-center
          w-14 h-14 rounded-2xl
          transition-all duration-300 ease-out
          ${isDragging ? 'cursor-grabbing scale-105' : 'cursor-grab hover:scale-105'}
          ${isPlaying
            ? 'text-emerald-500'
            : isDark
              ? 'text-zinc-400 hover:text-zinc-200'
              : 'text-slate-400 hover:text-slate-600'
          }
        `}
        style={{
          background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(91, 123, 140, 0.12)',
          boxShadow: isPlaying
            ? '0 10px 40px -10px rgba(16, 185, 129, 0.35)'
            : isDark
              ? '0 10px 40px -10px rgba(0, 0, 0, 0.5)'
              : '0 10px 40px -10px rgba(139, 91, 165, 0.12)'
        }}
      >
        {isPlaying ? (
          <div className="flex items-center gap-[3px]">
            {[12, 18, 10, 16, 8].map((h, i) => (
              <div
                key={i}
                className="w-[2.5px] bg-emerald-500 rounded-full"
                style={{
                  height: `${h}px`,
                  animation: `soundWave${(i % 3) + 1} ${0.6 + i * 0.1}s ease-in-out infinite`
                }}
              />
            ))}
          </div>
        ) : (
          Icons.headphones
        )}
      </button>

      {/* Play/Pause Quick Button */}
      {isExpanded && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            togglePlay()
          }}
          className={`
            absolute -left-16 bottom-0
            w-12 h-12 rounded-xl
            flex items-center justify-center
            transition-all duration-200
            ${isPlaying
              ? isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-400 hover:text-slate-600'
              : 'text-emerald-500 hover:text-emerald-400'
            }
          `}
          style={{
            background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(91, 123, 140, 0.12)',
          }}
        >
          {isPlaying ? Icons.pause : Icons.play}
        </button>
      )}

      <style jsx>{`
        @keyframes soundWave1 {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1); }
        }
        @keyframes soundWave2 {
          0%, 100% { transform: scaleY(0.7); }
          50% { transform: scaleY(0.4); }
        }
        @keyframes soundWave3 {
          0%, 100% { transform: scaleY(0.6); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}
