import { doc, writeBatch, Firestore, collection, getDocs } from 'firebase/firestore';
import { Outward, Transfer, Inward, StockMovement, Product, Warehouse, Supplier, Customer } from '../types';

/**
 * Extracts numeric value from a series string (e.g. "DSP-1003" -> 1003, "TRF-2026-005" -> 5)
 */
export function extractSeriesNumber(seriesStr: string, prefix: string): number | null {
  if (!seriesStr) return null;
  const regex = new RegExp(`^${prefix}[^0-9]*(\\d+)$`, 'i');
  const match = seriesStr.trim().match(regex);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  // Generic fallback if prefix differs
  const digitsMatch = seriesStr.match(/(\d+)/g);
  if (digitsMatch && digitsMatch.length > 0) {
    return parseInt(digitsMatch[digitsMatch.length - 1], 10);
  }
  return null;
}

/**
 * Generates the next guaranteed unique series number starting from baseNumber.
 * Ensures no collisions with existing active series numbers.
 */
export function generateNextUniqueSeries(
  prefix: string,
  existingSeriesNumbers: string[],
  baseNumber: number = 1001
): string {
  const cleanPrefix = prefix.endsWith('-') ? prefix : `${prefix}-`;
  const existingSet = new Set(existingSeriesNumbers.map(s => s?.trim().toUpperCase()));

  let candidateNum = baseNumber;
  // Extract all existing numbers to find the highest number if candidateNum is below max
  const existingNumbers = existingSeriesNumbers
    .map(s => extractSeriesNumber(s, cleanPrefix))
    .filter((n): n is number => n !== null);

  if (existingNumbers.length > 0) {
    const maxNum = Math.max(...existingNumbers);
    candidateNum = Math.max(baseNumber, maxNum + 1);
  }

  // Double check candidate is not in set
  while (existingSet.has(`${cleanPrefix}${candidateNum}`.toUpperCase())) {
    candidateNum++;
  }

  return `${cleanPrefix}${candidateNum}`;
}

/**
 * Validates whether a proposed series number is strictly unique.
 */
export function isSeriesUnique(
  proposedSeries: string,
  existingSeriesNumbers: string[],
  currentIdOrRef?: string
): boolean {
  if (!proposedSeries || !proposedSeries.trim()) return false;
  const target = proposedSeries.trim().toUpperCase();
  const duplicate = existingSeriesNumbers.some(
    s => s && s.trim().toUpperCase() === target && s.trim().toUpperCase() !== currentIdOrRef?.toUpperCase()
  );
  return !duplicate;
}

/**
 * Auto rearranges Outward Dispatch series numbers sequentially (e.g., DSP-1001, DSP-1002...)
 * Updates outwards collection and linked movements collection in Firestore.
 */
export async function rearrangeDispatchSeries(
  db: Firestore | null,
  outwards: Outward[],
  movements: StockMovement[],
  baseNumber: number = 1001
): Promise<{ updatedCount: number; oldToNewMap: Record<string, string> }> {
  // Group outwards by dispatchNumber
  const groupedMap: Record<string, Outward[]> = {};
  outwards.forEach(out => {
    if (!groupedMap[out.dispatchNumber]) {
      groupedMap[out.dispatchNumber] = [];
    }
    groupedMap[out.dispatchNumber].push(out);
  });

  // Sort distinct dispatches by date/time or original number
  const sortedDispatchNums = Object.keys(groupedMap).sort((a, b) => {
    const groupA = groupedMap[a];
    const groupB = groupedMap[b];
    const dateA = groupA[0]?.date || '';
    const dateB = groupB[0]?.date || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const numA = extractSeriesNumber(a, 'DSP-') || 0;
    const numB = extractSeriesNumber(b, 'DSP-') || 0;
    return numA - numB;
  });

  const oldToNewMap: Record<string, string> = {};
  let changedCount = 0;

  sortedDispatchNums.forEach((oldNum, idx) => {
    const targetNum = `DSP-${baseNumber + idx}`;
    if (oldNum !== targetNum) {
      oldToNewMap[oldNum] = targetNum;
      changedCount++;
    }
  });

  if (changedCount === 0 || !db) {
    return { updatedCount: 0, oldToNewMap };
  }

  // Perform Firestore Batch Updates
  const batch = writeBatch(db);

  // 1. Update outwards
  outwards.forEach(out => {
    if (out.id && oldToNewMap[out.dispatchNumber]) {
      const newNum = oldToNewMap[out.dispatchNumber];
      batch.update(doc(db, 'outwards', out.id), { dispatchNumber: newNum });
    }
  });

  // 2. Update linked movements
  movements.forEach(mvt => {
    if (mvt.id && oldToNewMap[mvt.referenceNumber]) {
      const newNum = oldToNewMap[mvt.referenceNumber];
      batch.update(doc(db, 'movements', mvt.id), { referenceNumber: newNum });
    }
  });

  await batch.commit();
  return { updatedCount: changedCount, oldToNewMap };
}

/**
 * Auto rearranges Stock Transfer series numbers sequentially (e.g., TRF-1001, TRF-1002...)
 * Updates transfers collection and linked movements collection in Firestore.
 */
export async function rearrangeTransferSeries(
  db: Firestore | null,
  transfers: Transfer[],
  movements: StockMovement[],
  baseNumber: number = 1001
): Promise<{ updatedCount: number; oldToNewMap: Record<string, string> }> {
  // Group transfers by transferNumber
  const groupedMap: Record<string, Transfer[]> = {};
  transfers.forEach(tr => {
    if (!groupedMap[tr.transferNumber]) {
      groupedMap[tr.transferNumber] = [];
    }
    groupedMap[tr.transferNumber].push(tr);
  });

  // Sort distinct transfers
  const sortedTransferNums = Object.keys(groupedMap).sort((a, b) => {
    const groupA = groupedMap[a];
    const groupB = groupedMap[b];
    const dateA = groupA[0]?.createdAt || '';
    const dateB = groupB[0]?.createdAt || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const numA = extractSeriesNumber(a, 'TRF-') || 0;
    const numB = extractSeriesNumber(b, 'TRF-') || 0;
    return numA - numB;
  });

  const oldToNewMap: Record<string, string> = {};
  let changedCount = 0;

  sortedTransferNums.forEach((oldNum, idx) => {
    const targetNum = `TRF-${baseNumber + idx}`;
    if (oldNum !== targetNum) {
      oldToNewMap[oldNum] = targetNum;
      changedCount++;
    }
  });

  if (changedCount === 0 || !db) {
    return { updatedCount: 0, oldToNewMap };
  }

  const batch = writeBatch(db);

  // 1. Update transfers
  transfers.forEach(tr => {
    if (tr.id && oldToNewMap[tr.transferNumber]) {
      const newNum = oldToNewMap[tr.transferNumber];
      batch.update(doc(db, 'transfers', tr.id), { transferNumber: newNum });
    }
  });

  // 2. Update linked movements
  movements.forEach(mvt => {
    if (mvt.id && oldToNewMap[mvt.referenceNumber]) {
      const newNum = oldToNewMap[mvt.referenceNumber];
      batch.update(doc(db, 'movements', mvt.id), { referenceNumber: newNum });
    }
  });

  await batch.commit();
  return { updatedCount: changedCount, oldToNewMap };
}

/**
 * Auto rearranges Inward GRN series numbers sequentially (e.g., GRN-1001, GRN-1002...)
 * Updates inwards collection and linked movements collection in Firestore.
 */
export async function rearrangeInwardSeries(
  db: Firestore | null,
  inwards: Inward[],
  movements: StockMovement[],
  baseNumber: number = 1001
): Promise<{ updatedCount: number; oldToNewMap: Record<string, string> }> {
  // Group inwards by grnNumber
  const groupedMap: Record<string, Inward[]> = {};
  inwards.forEach(inw => {
    if (!groupedMap[inw.grnNumber]) {
      groupedMap[inw.grnNumber] = [];
    }
    groupedMap[inw.grnNumber].push(inw);
  });

  // Sort distinct GRNs
  const sortedGrnNums = Object.keys(groupedMap).sort((a, b) => {
    const groupA = groupedMap[a];
    const groupB = groupedMap[b];
    const dateA = groupA[0]?.date || '';
    const dateB = groupB[0]?.date || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const numA = extractSeriesNumber(a, 'GRN-') || 0;
    const numB = extractSeriesNumber(b, 'GRN-') || 0;
    return numA - numB;
  });

  const oldToNewMap: Record<string, string> = {};
  let changedCount = 0;

  sortedGrnNums.forEach((oldNum, idx) => {
    const targetNum = `GRN-${baseNumber + idx}`;
    if (oldNum !== targetNum) {
      oldToNewMap[oldNum] = targetNum;
      changedCount++;
    }
  });

  if (changedCount === 0 || !db) {
    return { updatedCount: 0, oldToNewMap };
  }

  const batch = writeBatch(db);

  // 1. Update inwards
  inwards.forEach(inw => {
    if (inw.id && oldToNewMap[inw.grnNumber]) {
      const newNum = oldToNewMap[inw.grnNumber];
      batch.update(doc(db, 'inwards', inw.id), { grnNumber: newNum });
    }
  });

  // 2. Update linked movements
  movements.forEach(mvt => {
    if (mvt.id && oldToNewMap[mvt.referenceNumber]) {
      const newNum = oldToNewMap[mvt.referenceNumber];
      batch.update(doc(db, 'movements', mvt.id), { referenceNumber: newNum });
    }
  });

  await batch.commit();
  return { updatedCount: changedCount, oldToNewMap };
}

/**
 * Auto rearranges Manual Stock Adjustment series numbers sequentially (e.g., ADJ-1001, ADJ-1002...)
 * Updates movements collection in Firestore.
 */
export async function rearrangeAdjustmentSeries(
  db: Firestore | null,
  movements: StockMovement[],
  baseNumber: number = 1001
): Promise<{ updatedCount: number; oldToNewMap: Record<string, string> }> {
  // Filter adjustment movements
  const adjMovements = movements.filter(m => 
    m.transactionType.includes('Adjustment') || m.referenceNumber.startsWith('ADJ-')
  );

  // Group by referenceNumber
  const groupedMap: Record<string, StockMovement[]> = {};
  adjMovements.forEach(mvt => {
    if (!groupedMap[mvt.referenceNumber]) {
      groupedMap[mvt.referenceNumber] = [];
    }
    groupedMap[mvt.referenceNumber].push(mvt);
  });

  // Sort distinct ADJ refs
  const sortedAdjNums = Object.keys(groupedMap).sort((a, b) => {
    const groupA = groupedMap[a];
    const groupB = groupedMap[b];
    const dateA = groupA[0]?.date || '';
    const dateB = groupB[0]?.date || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const numA = extractSeriesNumber(a, 'ADJ-') || 0;
    const numB = extractSeriesNumber(b, 'ADJ-') || 0;
    return numA - numB;
  });

  const oldToNewMap: Record<string, string> = {};
  let changedCount = 0;

  sortedAdjNums.forEach((oldNum, idx) => {
    const targetNum = `ADJ-${baseNumber + idx}`;
    if (oldNum !== targetNum) {
      oldToNewMap[oldNum] = targetNum;
      changedCount++;
    }
  });

  if (changedCount === 0 || !db) {
    return { updatedCount: 0, oldToNewMap };
  }

  const batch = writeBatch(db);

  movements.forEach(mvt => {
    if (mvt.id && oldToNewMap[mvt.referenceNumber]) {
      const newNum = oldToNewMap[mvt.referenceNumber];
      batch.update(doc(db, 'movements', mvt.id), { referenceNumber: newNum });
    }
  });

  await batch.commit();
  return { updatedCount: changedCount, oldToNewMap };
}
