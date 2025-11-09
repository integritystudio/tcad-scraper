#!/usr/bin/env node
/**
 * Test script to check what the API returns for properties
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/properties/search',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('\nRaw Response:');
    console.log(data);
    
    try {
      const json = JSON.parse(data);
      console.log('\n\nParsed Response:');
      console.log(JSON.stringify(json, null, 2));
      
      if (json.data && json.data.length > 0) {
        console.log('\n\nFirst Property:');
        const firstProp = json.data[0];
        console.log('Name:', firstProp.name);
        console.log('appraised_value:', firstProp.appraised_value);
        console.log('Type of appraised_value:', typeof firstProp.appraised_value);
        console.log('Is NaN?', isNaN(firstProp.appraised_value));
      }
    } catch (e) {
      console.error('Failed to parse JSON:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
  console.error('Is the server running on port 3001?');
});

req.write(JSON.stringify({ query: 'test', limit: 5 }));
req.end();
