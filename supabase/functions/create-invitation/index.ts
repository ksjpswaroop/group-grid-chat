import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const createInvitationSchema = z.object({
  email: z.string().email().max(255),
  role: z.enum(['admin', 'moderator', 'user']).default('user'),
  expiresInDays: z.number().int().min(1).max(365).default(7)
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      throw new Error('Forbidden: Admin access required');
    }

    const body = await req.json();
    
    // Validate input
    const validationResult = createInvitationSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input data', details: validationResult.error.issues }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, role, expiresInDays } = validationResult.data;

    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const inviteToken = Array.from(tokenBytes, byte => byte.toString(16).padStart(2, '0')).join('');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const { data: invitation, error: insertError } = await supabase
      .from('invitations')
      .insert({
        email,
        token: inviteToken,
        invited_by: user.id,
        role,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (insertError) throw insertError;

    console.log(`Invitation created for ${email} by admin ${user.email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        invitation,
        inviteLink: `${req.headers.get('origin') || Deno.env.get('SUPABASE_URL')}/auth?token=${inviteToken}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating invitation:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    const message = error instanceof Error ? error.message : 'An error occurred';
    const isAuthError = message.includes('Forbidden') || message.includes('Unauthorized');
    return new Response(
      JSON.stringify({ error: isAuthError ? message : 'Unable to create invitation. Please try again.' }),
      { status: isAuthError ? 403 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
