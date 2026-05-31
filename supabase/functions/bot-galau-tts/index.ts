import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const ELEVENLABS_API_KEY = (Deno.env.get('ELEVENLABS_API_KEY') || '').trim()
    console.log('KEY_DIAG len=', ELEVENLABS_API_KEY.length, 'prefix=', ELEVENLABS_API_KEY.slice(0, 4))
    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: 'ELEVENLABS_API_KEY belum dikonfigurasi' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const rawText = String(body?.text ?? '').trim()
    // Voice default: Sarah (natural, support multilingual). Bisa dioverride dari client.
    const voiceId = String(body?.voiceId || 'EXAVITQu4vr4xnSDxMaL')
    if (!rawText) {
      return new Response(JSON.stringify({ error: 'Teks kosong' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const text = rawText.slice(0, 2500)

    const resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.8,
            style: 0.35,
            use_speaker_boost: true,
          },
        }),
      },
    )

    if (!resp.ok) {
      const errText = await resp.text()
      console.error('ElevenLabs error', resp.status, errText)
      return new Response(JSON.stringify({ error: `TTS gagal (${resp.status})` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const arrayBuffer = await resp.arrayBuffer()
    // Encode base64 secara chunk agar tidak stack overflow
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    const chunkSize = 0x8000
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
    }
    const base64 = btoa(binary)

    return new Response(JSON.stringify({ audioContent: base64 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('Error', e)
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
