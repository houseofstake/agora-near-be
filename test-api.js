const axios = require("axios");

const API_KEY = process.argv[2];
// Default to the dev api url if they don't specify one, but keep localhost available if they want local
const BASE_URL = process.argv[3] || "https://dev-api-agora-near.houseofstake.agora.space";

if (!API_KEY) {
  console.log("❌ Error: Por favor provee un API Key.");
  console.log("➡️  Uso: node /tmp/test-api.js <tu-api-key> [url-base-opcional]");
  console.log("   Ejemplo (Dev): node /tmp/test-api.js hos_dev_abcd1234");
  console.log("   Ejemplo (Local): node /tmp/test-api.js hos_dev_abcd1234 http://localhost:8080");
  process.exit(1);
}

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    "x-api-key": API_KEY,
    "Content-Type": "application/json"
  }
});

async function runTests() {
  console.log(`\n🚀 Iniciando pruebas de endpoints V1 apuntando a: ${BASE_URL}`);
  console.log(`🔑 Usando API Key: ${API_KEY.substring(0, 15)}...\n`);

  const endpoints = [
    { name: "Verificar Perfil del Agente", method: "GET", path: "/api/v1/me" },
    { name: "Consultar Propuestas Aprobadas", method: "GET", path: "/api/v1/proposals" },
    { name: "Consultar Lista de Delegados", method: "GET", path: "/api/v1/delegates" },
    { name: "Consultar APY de Staking", method: "GET", path: "/api/v1/staking/apy" },
    { name: "Consultar Supply de veNEAR", method: "GET", path: "/api/v1/venear/supply" }
  ];

  for (const ep of endpoints) {
    try {
      console.log(`⏳ Probando [${ep.method}] ${ep.path} (${ep.name})...`);
      const res = await client.request({ method: ep.method, url: ep.path });
      console.log(`  ✅ Éxito! Status: ${res.status}`);
      console.log(`  📄 Respuesta:`, JSON.stringify(res.data, null, 2).substring(0, 300) + (JSON.stringify(res.data).length > 300 ? "...\n" : "\n"));
    } catch (error) {
      console.log(`  ❌ Error en ${ep.path}:`);
      if (error.response) {
        console.log(`     Status: ${error.response.status}`);
        console.log(`     Datos:`, JSON.stringify(error.response.data));
      } else {
        console.log(`     Motivo:`, error.message);
      }
      console.log("\n");
    }
  }

  // Prueba de POST a Voto (Intento de Proxy Vote)
  try {
    console.log(`⏳ Probando [POST] /api/v1/vote (Emitir intent de voto proxy) ...`);
    const payload = { proposalId: 1, voteAction: "Approve" };
    const res = await client.post("/api/v1/vote", payload);
    console.log(`  ✅ Éxito! Status: ${res.status}`);
    console.log(`  📄 Respuesta:`, JSON.stringify(res.data, null, 2), "\n");
  } catch (error) {
    console.log(`  ❌ Error en /v1/vote:`);
    if (error.response) {
      console.log(`     Status: ${error.response.status}`);
      console.log(`     Datos:`, JSON.stringify(error.response.data));
    } else {
      console.log(`     Motivo:`, error.message);
    }
  }

  console.log("\n🏁 Pruebas finalizadas.");
}

runTests();
