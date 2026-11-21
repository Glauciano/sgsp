const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:senha@localhost:5432/sgc_sp'
});

// =========================================================================
// 1. MOTOR GEODÉSICO VINCENTY WGS84 (PRECISÃO 0.5mm)
// =========================================================================
function calcularVincentyWGS84(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const b = (1 - f) * a;
  const toRad = (deg) => (deg * Math.PI) / 180;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const L = toRad(lon2 - lon1);

  const U1 = Math.atan((1 - f) * Math.tan(phi1));
  const U2 = Math.atan((1 - f) * Math.tan(phi2));
  const sinU1 = Math.sin(U1), cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);

  let lambda = L, lambdaP, iter = 100;
  let sinSigma, cosSigma, sigma, sinAlpha, cosSqAlpha, cos2SigmaM;

  do {
    const sinLambda = Math.sin(lambda), cosLambda = Math.cos(lambda);
    sinSigma = Math.sqrt(
      (cosU2 * sinLambda) ** 2 +
      (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) ** 2
    );
    if (sinSigma === 0) return 0;
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cosSqAlpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM = cosSqAlpha !== 0 ? cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha : 0;
    const C = (f / 16) * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
    lambdaP = lambda;
    lambda = L + (1 - C) * f * sinAlpha * (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM ** 2)));
  } while (Math.abs(lambda - lambdaP) > 1e-12 && --iter > 0);

  if (iter === 0) return NaN;
  const uSq = (cosSqAlpha * (a * a - b * b)) / (b * b);
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const deltaSigma = B * sinSigma * (
    cos2SigmaM + (B / 4) * (
      cosSigma * (-1 + 2 * cos2SigmaM ** 2) -
      (B / 6) * cos2SigmaM * (-3 + 4 * sinSigma ** 2) * (-3 + 4 * cos2SigmaM ** 2)
    )
  );
  return Number((b * A * (sigma - deltaSigma)).toFixed(3));
}

// =========================================================================
// 2. CÁLCULO PROPORCIONAL DA MARCHA DO RELÓGIO (ACERTO -> ABERTURA)
// =========================================================================
function calcularHoraCorrigidaMarcha(chegadaBrutaStr, regRelogio) {
  if (!regRelogio || !regRelogio.hora_abertura_gps || !regRelogio.hora_relogio_abertura) {
    return new Date(chegadaBrutaStr);
  }

  const tAcertoGPS = new Date(regRelogio.hora_acerto_gps).getTime();
  const tAcertoRel = new Date(regRelogio.hora_relogio_acerto).getTime();
  const tAbertGPS = new Date(regRelogio.hora_abertura_gps).getTime();
  const tAbertRel = new Date(regRelogio.hora_relogio_abertura).getTime();
  const tBatidaRel = new Date(chegadaBrutaStr).getTime();

  const desvioInicial = tAcertoGPS - tAcertoRel;
  const desvioFinal = tAbertGPS - tAbertRel;
  const duracaoTotalRel = tAbertRel - tAcertoRel;

  if (duracaoTotalRel <= 0) return new Date(tBatidaRel + desvioFinal);

  const proporcao = (tBatidaRel - tAcertoRel) / duracaoTotalRel;
  const correcaoInterpolada = desvioInicial + proporcao * (desvioFinal - desvioInicial);

  return new Date(Math.round(tBatidaRel + correcaoInterpolada));
}

// =========================================================================
// 3. CÁLCULO DE TEMPO COM NEUTRALIZAÇÃO NOTURNA (HORA MORTA)
// =========================================================================
function calcularTempoVooSegundos(solturaStr, chegadaCorrigidaDate, usaHM, hmIni, hmFim) {
  const s = new Date(solturaStr);
  const c = chegadaCorrigidaDate;
  let segTotal = Math.floor((c.getTime() - s.getTime()) / 1000);

  if (!usaHM) return Math.max(1, segTotal);

  const [hi, mi, si] = hmIni.split(':').map(Number);
  const [hf, mf, sf] = hmFim.split(':').map(Number);
  const segIni = hi * 3600 + mi * 60 + (si || 0);
  const segFim = hf * 3600 + mf * 60 + (sf || 0);
  const duracaoNoite = (86400 - segIni) + segFim;

  const segDiaChegada = c.getHours() * 3600 + c.getMinutes() * 60 + c.getSeconds();
  if (segDiaChegada > segIni) segTotal -= (segDiaChegada - segIni);
  else if (segDiaChegada < segFim) segTotal += (segFim - segDiaChegada);

  const diaS = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const diaC = new Date(c.getFullYear(), c.getMonth(), c.getDate());
  const noites = Math.round((diaC - diaS) / 86400000);
  if (noites > 0) segTotal -= noites * duracaoNoite;

  return Math.max(1, segTotal);
}

// =========================================================================
// ROTA 1: GERAR MATRIZ OFICIAL DE DISTÂNCIAS (TODOS SÓCIOS x PONTOS SOLTURA)
// =========================================================================
app.post('/api/matriz-distancias/recalcular', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const socios = (await client.query('SELECT id, latitude, longitude FROM concorrentes')).rows;
    const solturas = (await client.query('SELECT id, latitude, longitude FROM pontos_soltura')).rows;

    let total = 0;
    for (const s of socios) {
      for (const ps of solturas) {
        const dist = calcularVincentyWGS84(
          parseFloat(ps.latitude), parseFloat(ps.longitude),
          parseFloat(s.latitude), parseFloat(s.longitude)
        );
        await client.query(
          `INSERT INTO matriz_distancias (concorrente_id, ponto_soltura_id, distancia_vincenty_metros)
           VALUES ($1, $2, $3)
           ON CONFLICT (concorrente_id, ponto_soltura_id)
           DO UPDATE SET distancia_vincenty_metros = $3, calculado_em = NOW()`,
          [s.id, ps.id, dist]
        );
        total++;
      }
    }
    await client.query('COMMIT');
    res.json({ mensagem: `Matriz Vincenty WGS84 atualizada: ${total} distâncias homologadas.` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: err.message });
  } finally {
    client.release();
  }
});

// =========================================================================
// ROTA 2: IMPORTAÇÃO DE ARQUIVO DE RELÓGIO (BENZING / BRICON / UNIKON / TAURIS)
// =========================================================================
app.post('/api/concursos/:id/importar-relogio', upload.single('arquivo'), async (req, res) => {
  const concursoId = req.params.id;
  if (!req.file) return res.status(400).json({ erro: 'Arquivo do constatador não enviado.' });

  const conteudo = req.file.buffer.toString('utf-8');
  const hashSha256 = crypto.createHash('sha256').update(conteudo).digest('hex');
  const linhas = conteudo.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let leiturasValidadas = 0;

    for (const linha of linhas) {
      const [anilhaRaw, timestampChegada, marca] = linha.split(/[;,|\t]+/);
      if (!anilhaRaw || !timestampChegada) continue;

      const upd = await client.query(
        `UPDATE encachotamentos e
         SET hora_chegada_bruta = $1, marca_relogio_leitura = $2
         FROM pombos p
         JOIN recenseamento_anual ra ON ra.pombo_id = p.id AND ra.pago_e_validado = TRUE
         WHERE e.pombo_id = p.id AND e.concurso_id = $3 AND p.anilha_completa = $4`,
        [timestampChegada.trim(), (marca || 'ELETRONICO').trim().toUpperCase(), concursoId, anilhaRaw.trim().toUpperCase()]
      );
      leiturasValidadas += upd.rowCount;
    }

    await client.query(`UPDATE concursos SET hash_arquivo_relogio = $1 WHERE id = $2`, [hashSha256, concursoId]);
    await client.query('COMMIT');
    res.json({ mensagem: `${leiturasValidadas} leituras homologadas.`, hash_sha256: hashSha256 });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: err.message });
  } finally {
    client.release();
  }
});

// =========================================================================
// ROTA 3: MOTOR DE APURAÇÃO COMPLETA, RATEIO POULE.S E DOUBLAGEM CRUZADA
// =========================================================================
app.post('/api/concursos/:id/apurar-completo', async (req, res) => {
  const concursoId = req.params.id;
  const { entidadesDoublagemIds } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const conc = (await client.query(
      `SELECT c.*, ps.latitude AS lat_solt, ps.longitude AS lon_solt
       FROM concursos c JOIN pontos_soltura ps ON c.ponto_soltura_id = ps.id
       WHERE c.id = $1`, [concursoId]
    )).rows[0];
    if (!conc) throw new Error('Concurso inexistente.');

    const totalEncachotados = parseInt(
      (await client.query(`SELECT COUNT(*) FROM encachotamentos WHERE concurso_id = $1`, [concursoId])).rows[0].count, 10
    );

    const inscritos = (await client.query(
      `SELECT e.*, co.latitude AS lat_pombal, co.longitude AS lon_pombal,
              rc.hora_acerto_gps, rc.hora_relogio_acerto, rc.hora_abertura_gps, rc.hora_relogio_abertura
       FROM encachotamentos e
       JOIN concorrentes co ON e.concorrente_id = co.id
       LEFT JOIN relogios_concurso rc ON rc.concurso_id = e.concurso_id AND rc.concorrente_id = e.concorrente_id
       WHERE e.concurso_id = $1 AND e.hora_chegada_bruta IS NOT NULL`,
      [concursoId]
    )).rows;

    const apurados = inscritos.map((item) => {
      const distM = calcularVincentyWGS84(
        parseFloat(conc.lat_solt), parseFloat(conc.lon_solt),
        parseFloat(item.lat_pombal), parseFloat(item.lon_pombal)
      );
      const horaCorrigida = calcularHoraCorrigidaMarcha(item.hora_chegada_bruta, item);
      const tempoSeg = calcularTempoVooSegundos(
        conc.data_hora_soltura, horaCorrigida,
        conc.usa_hora_morta, conc.hora_morta_inicio, conc.hora_morta_fim
      );
      const vel = Number((distM / (tempoSeg / 60)).toFixed(4));
      return { ...item, distM, horaCorrigida, tempoSeg, vel };
    });

    apurados.sort((a, b) => b.vel - a.vel);

    const fundoSerieA = inscritos.filter((i) => i.is_serie_a).length * parseFloat(conc.valor_serie_a || 0);
    const fundoOuro = inscritos.filter((i) => i.is_anel_ouro).length * parseFloat(conc.valor_anel_ouro || 0);
    const rateioPct = [0.50, 0.30, 0.20];

    let rankSerieA = 0;
    let rankOuro = 0;

    apurados.forEach((item) => {
      let premio = 0;
      if (item.is_serie_a) {
        if (rankSerieA < 3) premio += fundoSerieA * rateioPct[rankSerieA];
        rankSerieA++;
      }
      if (item.is_anel_ouro) {
        if (rankOuro < 3) premio += fundoOuro * rateioPct[rankOuro];
        rankOuro++;
      }
      item.premioFinanceiro = Number(premio.toFixed(2));
    });

    await client.query(`DELETE FROM classificacoes WHERE concurso_id = $1`, [concursoId]);
    const entidadesAlvo = entidadesDoublagemIds?.length ? entidadesDoublagemIds : [conc.entidade_organizadora_id];

    for (const entId of entidadesAlvo) {
      const reg = (await client.query(
        `SELECT * FROM regulamentos WHERE entidade_id = $1 AND temporada = $2`, [entId, conc.temporada]
      )).rows[0] || { metodo_pontuacao: 'PERCENTAGEM', percentual_corte: 20 };

      const corteAves = Math.max(1, Math.ceil(totalEncachotados * (parseFloat(reg.percentual_corte) / 100)));

      for (let i = 0; i < apurados.length; i++) {
        const r = apurados[i];
        const pos = i + 1;
        const coefFci = Number(((pos * 1000) / totalEncachotados).toFixed(4));
        const pontos = reg.metodo_pontuacao === 'VELOCIDADE_1000'
          ? Number(((r.vel * 1000) / apurados[0].vel).toFixed(2))
          : (pos <= corteAves ? Number((100 - ((pos - 1) * (80 / corteAves))).toFixed(2)) : 0);

        await client.query(
          `UPDATE encachotamentos SET hora_chegada_corrigida = $1 WHERE id = $2`,
          [r.horaCorrigida, r.id]
        );

        await client.query(
          `INSERT INTO classificacoes
           (concurso_id, entidade_id, pombo_id, concorrente_id, distancia_metros, tempo_voo_segundos, velocidade_m_min, posicao, coeficiente_fci, pontos_obtidos, is_designado, premio_financeiro)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [concursoId, entId, r.pombo_id, r.concorrente_id, r.distM, r.tempoSeg, r.vel, pos, coefFci, pontos, r.is_designado, r.premioFinanceiro]
        );
      }
    }

    await client.query(`UPDATE concursos SET status = 'APURADO' WHERE id = $1`, [concursoId]);
    await client.query('COMMIT');
    res.json({ mensagem: 'Apuração completa, marcha de relógios, poules e doublagem concluídas!', total: apurados.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: err.message });
  } finally {
    client.release();
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req,res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'), err => {
    if(err) res.json({ status: 'SGC-SP API Vincenty WGS84 online', port: 3001, version: '5.0 Integral S.G.S.P', endpoints: ['/api/matriz-distancias/recalcular','/api/concursos/:id/importar-relogio','/api/concursos/:id/apurar-completo'] });
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 S.G.S.P Backend Oficial rodando na porta ${PORT} - Espelho Integral S.G.S.P`));
