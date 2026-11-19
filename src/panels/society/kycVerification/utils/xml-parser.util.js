/**
 * Helper to extract attributes from XML tags (e.g. name="John Doe")
 * 
 * @param {string} xmlString The raw XML string
 * @param {string} attributeName The attribute key name
 * @returns {string|null} The attribute value or null if not found
 */
const extractAttribute = (xmlString, attributeName) => {
  if (typeof xmlString !== 'string') return null;
  const regex = new RegExp(`${attributeName}=["']([^"']*)["']`, 'i');
  const match = xmlString.match(regex);
  return match ? match[1].trim() : null;
};

const extractTagValue = (xmlString, tagName) => {
  if (typeof xmlString !== 'string') return null;
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
  const match = xmlString.match(regex);
  return match ? match[1].trim() : null;
};

export const encodeXmlToBase64 = (xmlInput) => {
  if (!xmlInput) return '';
  if (typeof xmlInput === 'object') {
    return Buffer.from(JSON.stringify(xmlInput), 'utf-8').toString('base64');
  }
  const str = String(xmlInput).trim();
  if (!str.startsWith('<') && !str.startsWith('{')) {
    return str;
  }
  return Buffer.from(str, 'utf-8').toString('base64');
};

export const decodeBase64Xml = (base64String) => {
  if (!base64String || typeof base64String !== 'string') return '';
  const trimmed = base64String.trim();
  if (trimmed.startsWith('<') || trimmed.startsWith('{')) return trimmed;

  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
    console.log(`[XML Parser] Decoded Base64 string (${decoded.length} characters)`);
    return decoded;
  } catch (error) {
    console.error('[XML Parser Error] Failed to decode base64:', error.message);
    return trimmed;
  }
};

export const formatDobForCibil = (dobInput) => {
  if (!dobInput) return null;
  const str = String(dobInput).trim();
  if (!str) return null;
  // If format is DD-MM-YYYY (e.g. 10-05-2000), convert to DD/MM/YYYY (10/05/2000) for CIBIL API compatibility
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(str)) {
    return str.replace(/-/g, '/');
  }
  return str;
};

export const parseAadhaarXml = (xmlInput) => {
  if (!xmlInput) return null;
  const xmlString = typeof xmlInput === 'string' ? decodeBase64Xml(xmlInput) : '';

  console.log('[XML Parser] Parsing Aadhaar XML content...');

  // Fallback if input is JSON object
  if (typeof xmlInput === 'object' && xmlInput !== null) {
    const name = xmlInput.fullName || xmlInput.name || xmlInput.FullName || xmlInput.Name;
    if (name) {
      return {
        fullName: String(name).trim(),
        dob: formatDobForCibil(xmlInput.dob || xmlInput.DateOfBirth || null),
        gender: xmlInput.gender || xmlInput.Gender || null,
        fatherName: xmlInput.fatherName || xmlInput.co || null,
        address: xmlInput.address || xmlInput.Address || null,
        pinCode: xmlInput.pinCode || xmlInput.pincode || xmlInput.pc || null
      };
    }
  }

  // If decoded string is JSON
  if (xmlString.startsWith('{') && xmlString.endsWith('}')) {
    try {
      const parsedJson = JSON.parse(xmlString);
      return parseAadhaarXml(parsedJson);
    } catch (e) {
      // Continue XML Regex parsing
    }
  }

  // Extract from common UIDAI XML schemas
  const name = extractAttribute(xmlString, 'name') || 
               extractTagValue(xmlString, 'name') || 
               extractTagValue(xmlString, 'FullName') ||
               extractAttribute(xmlString, 'n') ||
               extractAttribute(xmlString, 'fullName');

  const dob = extractAttribute(xmlString, 'dob') || 
              extractTagValue(xmlString, 'dob') || 
              extractTagValue(xmlString, 'DateOfBirth') ||
              extractAttribute(xmlString, 'd');

  const gender = extractAttribute(xmlString, 'gender') || 
                 extractAttribute(xmlString, 'g') || 
                 extractTagValue(xmlString, 'gender') ||
                 extractTagValue(xmlString, 'Gender');

  const co = extractAttribute(xmlString, 'co') || 
             extractTagValue(xmlString, 'careof') || 
             extractTagValue(xmlString, 'co');

  const house = extractAttribute(xmlString, 'house') || extractTagValue(xmlString, 'house') || '';
  const street = extractAttribute(xmlString, 'street') || extractTagValue(xmlString, 'street') || '';
  const lm = extractAttribute(xmlString, 'lm') || extractTagValue(xmlString, 'lm') || '';
  const loc = extractAttribute(xmlString, 'loc') || extractTagValue(xmlString, 'loc') || '';
  const vtc = extractAttribute(xmlString, 'vtc') || extractTagValue(xmlString, 'vtc') || '';
  const dist = extractAttribute(xmlString, 'dist') || extractTagValue(xmlString, 'dist') || '';
  const state = extractAttribute(xmlString, 'state') || extractTagValue(xmlString, 'state') || '';
  const pc = extractAttribute(xmlString, 'pc') || extractAttribute(xmlString, 'pincode') || extractTagValue(xmlString, 'pc') || '';

  const addressComponents = [house, street, lm, loc, vtc, dist, state, pc].map(c => c.trim()).filter(Boolean);
  const fullAddress = addressComponents.length > 0 ? addressComponents.join(', ') : (extractTagValue(xmlString, 'address') || null);

  const formattedGender = (gender === 'M' || gender === 'Male' || gender === 'MALE') 
    ? 'Male' 
    : (gender === 'F' || gender === 'Female' || gender === 'FEMALE') 
      ? 'Female' 
      : gender;

  // Extract 12-digit unmasked Aadhaar number
  let aadhaarNum = null;
  let isMasked = false;
  const unmaskedMatches = xmlString.match(/\b[2-9]\d{11}\b/g);
  if (unmaskedMatches && unmaskedMatches.length > 0) {
    aadhaarNum = unmaskedMatches[0];
  }

  if (!aadhaarNum) {
    const rawUid = extractAttribute(xmlString, 'uid') || 
                   extractTagValue(xmlString, 'uid') || 
                   extractAttribute(xmlString, 'aadhaar') ||
                   extractTagValue(xmlString, 'aadhaar') ||
                   extractAttribute(xmlString, 'aadhaarNumber') ||
                   extractTagValue(xmlString, 'aadhaarNumber');
    if (rawUid) {
      const cleanUid = String(rawUid).replace(/\D/g, '');
      if (cleanUid.length === 12 && /^[2-9]/.test(cleanUid)) {
        aadhaarNum = cleanUid;
      } else {
        aadhaarNum = String(rawUid).trim();
        isMasked = true;
      }
    }
  }

  const result = {
    fullName: name,
    dob: formatDobForCibil(dob),
    gender: formattedGender,
    fatherName: co ? co.replace(/^(C\/O|S\/O|D\/O|W\/O):\s*/i, '').trim() : null,
    address: fullAddress,
    pinCode: pc || null,
    aadhaarNumber: aadhaarNum,
    isMasked
  };

  console.log('[XML Parser] Parsed Aadhaar Details:', JSON.stringify(result, null, 2));
  return result;
};

export const parsePanXml = (xmlInput) => {
  if (!xmlInput) return null;
  const xmlString = typeof xmlInput === 'string' ? decodeBase64Xml(xmlInput) : '';

  console.log('[XML Parser] Parsing PAN XML content...');

  if (typeof xmlInput === 'object' && xmlInput !== null) {
    const name = xmlInput.fullName || xmlInput.name || xmlInput.FullName || xmlInput.Name;
    if (name) {
      return {
        panNumber: xmlInput.panNumber || xmlInput.pan || xmlInput.num || null,
        fullName: String(name).trim(),
        dob: formatDobForCibil(xmlInput.dob || null),
        gender: xmlInput.gender || null
      };
    }
  }

  if (xmlString.startsWith('{') && xmlString.endsWith('}')) {
    try {
      const parsedJson = JSON.parse(xmlString);
      return parsePanXml(parsedJson);
    } catch (e) {
      // Continue XML Regex parsing
    }
  }

  const isDocumentTitle = (val) => {
    if (!val || typeof val !== 'string') return true;
    const lower = val.toLowerCase().trim();
    return lower.includes('verification record') || lower.includes('certificate') || lower.includes('document') || lower.includes('income tax department');
  };

  const personTagMatch = xmlString.match(/<(?:Person|IssuedTo|User|Applicant)[^>]*name=["']([^"']*)["']/i);
  let rawName = personTagMatch ? personTagMatch[1] : null;

  if (!rawName || isDocumentTitle(rawName)) {
    const allNameMatches = [...xmlString.matchAll(/name=["']([^"']*)["']/gi)];
    for (const m of allNameMatches) {
      if (m[1] && !isDocumentTitle(m[1])) {
        rawName = m[1];
        break;
      }
    }
  }

  if (!rawName || isDocumentTitle(rawName)) {
    rawName = extractTagValue(xmlString, 'fullName') || extractTagValue(xmlString, 'FullName') || extractTagValue(xmlString, 'name');
    if (isDocumentTitle(rawName)) rawName = null;
  }

  const panMatch = xmlString.match(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/i);
  const pan = panMatch ? panMatch[0].toUpperCase() : (extractAttribute(xmlString, 'num') || extractTagValue(xmlString, 'PAN') || extractTagValue(xmlString, 'panNumber') || extractAttribute(xmlString, 'pan'));

  const dob = extractAttribute(xmlString, 'dob') || extractTagValue(xmlString, 'dob');
  const gender = extractAttribute(xmlString, 'gender') || extractTagValue(xmlString, 'gender');
  const fatherName = extractAttribute(xmlString, 'fatherName') || extractTagValue(xmlString, 'fatherName');

  const formattedGender = (gender === 'M' || gender === 'Male' || gender === 'MALE') 
    ? 'Male' 
    : (gender === 'F' || gender === 'Female' || gender === 'FEMALE') 
      ? 'Female' 
      : gender;

  const result = {
    panNumber: pan,
    fullName: rawName ? rawName.trim() : null,
    dob: formatDobForCibil(dob),
    gender: formattedGender,
    fatherName
  };

  console.log('[XML Parser] Parsed PAN Details:', JSON.stringify(result, null, 2));
  return result;
};

