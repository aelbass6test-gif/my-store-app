import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://keqmlcqymkohxzcouxfi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlcW1sY3F5bWtvaHh6Y291eGZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1ODU0NzAsImV4cCI6MjA4NjE2MTQ3MH0.OfxqWM9CFCcLj62u5KLWZyiiBhUH-miUu882Cqlwf4I';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data } = await supabase.from('stores_data').select('id, name, settings');
  for (const row of data || []) {
      const wuilt = (row.settings as any)?.platformConfigs?.wuilt;
      if (wuilt?.apiKey) {
          const query = `
            query ListStoreOrders($storeId: ID!) {
              orders(storeId: $storeId) {
                nodes {
                  id
                  shippingStatus
                  shippingRate {
                    cost { amount }
                    name
                  }
                  # Let's try to find the short ID
                  ... on Order {
                    # name - failed before
                    # orderNumber - failed before
                    # number - trying now
                    # reference - trying now
                    # code - trying now
                  }
                }
              }
            }
          `;
          // We'll try individually to avoid total failure
          const tryFields = ['number', 'reference', 'code', 'serialId', 'displayId', 'refCode', 'invoiceCode'];
          for (const field of tryFields) {
              const testQuery = `query { orders(storeId: "${wuilt.shopId}") { nodes { id ${field} } } }`;
              const res = await fetch('https://graphql.wuilt.com/', {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'x-api-key': wuilt.apiKey, 'x-wuilt-store-id': wuilt.shopId},
                body: JSON.stringify({ query: testQuery })
              });
              const json = await res.json();
              if (json.data?.orders?.nodes) {
                  console.log(`FIELD FOUND: ${field} = ${json.data.orders.nodes[0][field]}`);
              } else {
                  // console.log(`FIELD FAILED: ${field}`);
              }
          }
          break;
      }
  }
}
run();
