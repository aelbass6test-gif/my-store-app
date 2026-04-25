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
                  createdAt
                  status
                  paymentStatus
                  fulfillmentStatus
                  customer {
                    name
                    phone
                    email
                  }
                  shippingAddress {
                    addressLine1
                    addressLine2
                  }
                  items {
                    ... on SimpleItem {
                      title
                      quantity
                      price { amount }
                    }
                  }
                  subtotal { amount }
                  shippingRate {
                    cost { amount }
                    name
                  }
                  notes
                }
              }
            }
          `;
          const res = await fetch('https://graphql.wuilt.com/', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'x-api-key': wuilt.apiKey, 'x-wuilt-store-id': wuilt.shopId},
            body: JSON.stringify({ query, variables: { storeId: wuilt.shopId } })
          });
          const json = await res.json();
          if (json.data?.orders?.nodes && json.data.orders.nodes.length > 0) {
              const order = json.data.orders.nodes[0];
              console.log("SUCCESS! Sample Data:");
              console.log(JSON.stringify(order, null, 2));
          } else {
              console.log("FAILED or NO DATA:", JSON.stringify(json.errors || json.data, null, 2));
          }
          break;
      }
  }
}
run();
