// A presenter-facing AI persona, built from the four full-length character
// cutouts in public/avatars/ (transparent PNGs, roughly 1:2.7 portrait —
// NOT headshots, so this never crops or masks them into a square/circle:
// that clipped the head off entirely for a tall image centred by a square
// object-cover box). The character floats free over the page, sized by
// height with its own aspect ratio doing the rest.
//
// There's no lip-synced rig here — that needs either a separate mouth-shape
// asset per character or a Rive rig, and only one static pose exists per
// character today. Presence instead comes from two cheap, honest motions:
// a slow idle sway so it never looks like a frozen photo, and a quicker
// head-bob plus a small voice-bar chip near where the mouth sits while
// `talking` is true — driven by the browser's speechSynthesis start/end
// events, since SpeechSynthesisUtterance exposes no audio stream for a
// real AnalyserNode to read.
const AVATARS = {
  kai: { name: 'Kai', src: '/avatars/kai.png', gender: 'male' },
  maya: { name: 'Maya', src: '/avatars/maya.png', gender: 'female' },
  aditya: { name: 'Aditya', src: '/avatars/aditya.png', gender: 'male' },
  zoey: { name: 'Zoey', src: '/avatars/zoey.png', gender: 'female' },
}

export const AVATAR_IDS = Object.keys(AVATARS)

export function AvatarPlayer({ avatarId, height = 200, talking = false }) {
  const avatar = AVATARS[avatarId] ?? AVATARS.maya
  return (
    <div className="relative inline-flex" style={{ height }}>
      <img
        src={avatar.src}
        alt={avatar.name}
        style={{
          height: '100%',
          width: 'auto',
          objectFit: 'contain',
          filter: talking
            ? 'drop-shadow(0 10px 18px rgba(19,58,122,0.28))'
            : 'drop-shadow(0 6px 12px rgba(11,27,59,0.14))',
          animation: talking
            ? 'avatar-talk-bob 0.55s ease-in-out infinite alternate'
            : 'avatar-idle-sway 3.2s ease-in-out infinite alternate',
          transformOrigin: 'bottom center',
        }}
      />
      {talking && (
        <div
          className="absolute flex items-end gap-[2px]"
          style={{ top: '10%', right: '-10px' }}
          aria-hidden="true"
        >
          {[0.5, 1, 0.65, 0.85].map((h, i) => (
            <span
              key={i}
              className="block w-[3px] rounded-full bg-accent"
              style={{
                height: `${h * 14}px`,
                animation: `avatar-voice-bar 0.5s ${i * 0.09}s infinite ease-in-out alternate`,
              }}
            />
          ))}
        </div>
      )}
      <style>{`
        @keyframes avatar-idle-sway { from { transform: rotate(-0.6deg); } to { transform: rotate(0.6deg); } }
        @keyframes avatar-talk-bob { from { transform: translateY(0) scale(1); } to { transform: translateY(-3px) scale(1.015); } }
        @keyframes avatar-voice-bar { from { transform: scaleY(0.35); } to { transform: scaleY(1); } }
      `}</style>
    </div>
  )
}

export function avatarName(avatarId) {
  return (AVATARS[avatarId] ?? AVATARS.maya).name
}

/** The gender that avatar's voice must match — used to pick a spoken-audio
 * voice (lib/tts.js) so an avatar never talks in the wrong gender's voice. */
export function avatarGender(avatarId) {
  return (AVATARS[avatarId] ?? AVATARS.maya).gender
}
