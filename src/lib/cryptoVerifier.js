// =========================================================================
// 🧩 PuzzleRadar — Motor de Verificação Criptográfica de Descobertas (Anti-Fake)
// =========================================================================
// Valida matematicamente se uma chave privada submetida gera exatamente
// o endereço Bitcoin / chave pública esperados pelo desafio antes de salvar.
// =========================================================================

const crypto = require('crypto');

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(buffer) {
  let num = BigInt('0x' + buffer.toString('hex'));
  let encoded = '';
  while (num > 0n) {
    const remainder = Number(num % 58n);
    num = num / 58n;
    encoded = ALPHABET[remainder] + encoded;
  }
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    encoded = '1' + encoded;
  }
  return encoded;
}

/**
 * Normaliza uma chave privada em formato hexadecimal de 64 caracteres (32 bytes)
 */
function normalizePrivateKey(privHex) {
  let clean = privHex.trim().replace(/^0x/i, '');
  if (clean.length > 64) {
    clean = clean.slice(-64);
  }
  return clean.padStart(64, '0');
}

/**
 * Deriva a chave pública e endereço Bitcoin a partir de uma chave privada em hex
 */
function deriveBitcoinAddress(privateKeyHex) {
  const normHex = normalizePrivateKey(privateKeyHex);
  const privBuf = Buffer.from(normHex, 'hex');

  const ecdh = crypto.createECDH('secp256k1');
  ecdh.setPrivateKey(privBuf);

  // Chave pública comprimida (02 ou 03 + 32 bytes)
  const pubCompressed = ecdh.getPublicKey(null, 'compressed');
  const pubCompressedHex = pubCompressed.toString('hex');

  // Chave pública descomprimida (04 + 64 bytes)
  const pubUncompressed = ecdh.getPublicKey(null, 'uncompressed');
  const pubUncompressedHex = pubUncompressed.toString('hex');

  // Endereço Comprimido (Padrão 1000 BTC)
  const shaComp = crypto.createHash('sha256').update(pubCompressed).digest();
  const ripeComp = crypto.createHash('ripemd160').update(shaComp).digest();
  const payloadComp = Buffer.concat([Buffer.from([0x00]), ripeComp]);
  const checkComp = crypto.createHash('sha256').update(
    crypto.createHash('sha256').update(payloadComp).digest()
  ).digest().subarray(0, 4);
  const addressCompressed = base58Encode(Buffer.concat([payloadComp, checkComp]));

  // Endereço Descomprimido
  const shaUncomp = crypto.createHash('sha256').update(pubUncompressed).digest();
  const ripeUncomp = crypto.createHash('ripemd160').update(shaUncomp).digest();
  const payloadUncomp = Buffer.concat([Buffer.from([0x00]), ripeUncomp]);
  const checkUncomp = crypto.createHash('sha256').update(
    crypto.createHash('sha256').update(payloadUncomp).digest()
  ).digest().subarray(0, 4);
  const addressUncompressed = base58Encode(Buffer.concat([payloadUncomp, checkUncomp]));

  return {
    privateKeyHex: normHex,
    pubCompressedHex,
    pubUncompressedHex,
    addressCompressed,
    addressUncompressed
  };
}

/**
 * Valida se uma chave privada corresponde a um endereço Bitcoin alvo ou chave pública esperada
 */
function verifyDiscoveryProof(privateKeyHex, expectedAddressOrPubKey) {
  try {
    const derived = deriveBitcoinAddress(privateKeyHex);
    const target = (expectedAddressOrPubKey || '').trim();

    const matchesAddress = (
      derived.addressCompressed.toLowerCase() === target.toLowerCase() ||
      derived.addressUncompressed.toLowerCase() === target.toLowerCase()
    );

    const matchesPubKey = (
      derived.pubCompressedHex.toLowerCase() === target.toLowerCase() ||
      derived.pubUncompressedHex.toLowerCase() === target.toLowerCase()
    );

    return {
      isValid: matchesAddress || matchesPubKey,
      derived,
      target
    };
  } catch (err) {
    return {
      isValid: false,
      error: err.message
    };
  }
}

/**
 * Valida matematicamente se uma Chave Pública em Hex corresponde ao Endereço Bitcoin alvo
 * Endereço = Base58Check(0x00 || RIPEMD160(SHA256(PubKey)))
 */
function verifyPubKeyToAddress(pubKeyHex, expectedAddress) {
  try {
    if (!pubKeyHex || !expectedAddress) {
      return { isValid: false, reason: 'Chave pública ou endereço ausente' };
    }
    const cleanPub = pubKeyHex.trim().replace(/^0x/i, '');
    const pubBuf = Buffer.from(cleanPub, 'hex');

    // SHA256 seguido de RIPEMD160
    const sha = crypto.createHash('sha256').update(pubBuf).digest();
    const ripe = crypto.createHash('ripemd160').update(sha).digest();
    const payload = Buffer.concat([Buffer.from([0x00]), ripe]);
    
    // Checksum de 4 bytes
    const check = crypto.createHash('sha256').update(
      crypto.createHash('sha256').update(payload).digest()
    ).digest().subarray(0, 4);

    const derivedAddress = base58Encode(Buffer.concat([payload, check]));
    const isValid = derivedAddress.toLowerCase() === expectedAddress.trim().toLowerCase();

    return {
      isValid,
      derivedAddress,
      expectedAddress: expectedAddress.trim(),
      reason: isValid ? 'Matematicamente verificado' : 'Divergência entre chave pública e endereço'
    };
  } catch (err) {
    return {
      isValid: false,
      reason: err.message
    };
  }
}

module.exports = {
  deriveBitcoinAddress,
  verifyDiscoveryProof,
  verifyPubKeyToAddress,
  normalizePrivateKey
};
