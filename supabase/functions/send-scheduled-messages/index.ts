import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get pending scheduled messages that are due now
    const now = new Date().toISOString();
    const { data: scheduledMessages, error: fetchError } = await supabaseClient
      .from('scheduled_messages')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .is('cancelled_at', null);

    if (fetchError) {
      console.error('Error fetching scheduled messages:', fetchError);
      throw fetchError;
    }

    let successCount = 0;
    let failureCount = 0;

    console.log(`Processing ${scheduledMessages?.length || 0} scheduled messages`);

    for (const msg of scheduledMessages || []) {
      try {
        // Insert the message
        const { error: insertError } = await supabaseClient
          .from('messages')
          .insert({
            channel_id: msg.channel_id,
            user_id: msg.user_id,
            content: msg.content,
          });

        if (insertError) throw insertError;

        // Mark as sent
        const { error: updateError } = await supabaseClient
          .from('scheduled_messages')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', msg.id);

        if (updateError) throw updateError;

        successCount++;
        console.log(`Successfully sent scheduled message ${msg.id}`);
      } catch (error) {
        console.error(`Failed to send scheduled message ${msg.id}:`, error);
        
        // Mark as failed
        await supabaseClient
          .from('scheduled_messages')
          .update({ status: 'failed' })
          .eq('id', msg.id);

        failureCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: scheduledMessages?.length || 0,
        sent: successCount,
        failed: failureCount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-scheduled-messages function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
