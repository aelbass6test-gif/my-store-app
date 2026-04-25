import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://keqmlcqymkohxzcouxfi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlcW1sY3F5bWtvaHh6Y291eGZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1ODU0NzAsImV4cCI6MjA4NjE2MTQ3MH0.OfxqWM9CFCcLj62u5KLWZyiiBhUH-miUu882Cqlwf4I';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data } = await supabase.from('stores_data').select('id, settings');
  const store = data?.find(s => (s.settings as any)?.platformConfigs?.wuilt?.apiKey);
  
  if (!store) {
    console.log("No store with Wuilt API key found.");
    return;
  }

  const wuilt = (store.settings as any).platformConfigs.wuilt;
  
  const query = `
    query ListStoreOrders($storeId: ID!) {
      orders(storeId: $storeId) {
        nodes {
          id
          # Intentionally wrong fields to get suggestions
          orderNumber
          displayId
          invoiceNumber
          totalAmount
          taxAmount
          discountAmount
          shippingAmount
          orderName
          orderReference
        }
      }
    }
  `;

  const res = await fetch('https://graphql.wuilt.com/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': wuilt.apiKey,
      'x-wuilt-store-id': wuilt.shopId
    },
    body: JSON.stringify({ query, variables: { storeId: wuilt.shopId } })
  });

  const json = await res.json();
  console.log("Errors:", JSON.stringify(json.errors, null, 2));
}

run();
