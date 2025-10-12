import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AccessToken } from "https://esm.sh/livekit-server-sdk@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { roomName, callId } = await req.json();
    console.log('Creating token for room:', roomName, 'callId:', callId, 'user:', user.id);

    // Get LiveKit config
    const { data: config, error: configError } = await supabase
      .from('livekit_config')
      .select('api_key, api_secret')
      .limit(1)
      .maybeSingle();

    if (configError) {
      console.error('Error fetching LiveKit config:', configError);
      return new Response(JSON.stringify({ error: 'Failed to fetch LiveKit configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!config) {
      console.error('LiveKit not configured');
      return new Response(JSON.stringify({ error: 'LiveKit not configured. Please configure LiveKit in Admin settings.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    console.log('User profile:', profile);

    // Create LiveKit access token
    const at = new AccessToken(config.api_key, config.api_secret, {
      identity: user.id,
      name: profile?.full_name || user.email || 'User',
      ttl: '2h',
    });

    at.addGrant({ 
      roomJoin: true, 
      room: roomName, 
      canPublish: true, 
      canSubscribe: true,
      canPublishData: true 
    });

    const token = await at.toJwt();
    console.log('Token created successfully');

    // Record participant joining
    const { error: participantError } = await supabase.from('call_participants').upsert({
      call_id: callId,
      user_id: user.id,
      joined_at: new Date().toISOString(),
    }, {
      onConflict: 'call_id,user_id'
    });

    if (participantError) {
      console.error('Error recording participant:', participantError);
    }

    return new Response(JSON.stringify({ token, roomName }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error creating LiveKit token:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
