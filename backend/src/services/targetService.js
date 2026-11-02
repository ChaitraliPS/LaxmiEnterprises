import { Target } from "../models/index.js";
import { getFiscalYear } from "../utils/dateUtils.js";

export async function getTargets({ fiscalYear = null } = {}) {
  const fy = fiscalYear || getFiscalYear(new Date());
  let targets = await Target.findAll({
    where: { fiscalYear: fy },
    order: [["quarter", "ASC"]],
  });

  // If no targets exist for requested FY, initialize them cleanly with 0
  if (targets.length === 0) {
    const quarters = ["Q1", "Q2", "Q3", "Q4"];
    for (const q of quarters) {
      await Target.findOrCreate({
        where: { fiscalYear: fy, quarter: q },
        defaults: {
          fiscalYear: fy,
          quarter: q,
          targetAmount: 0.0,
          notes: `${q} Target for ${fy}`,
        },
      });
    }
    targets = await Target.findAll({
      where: { fiscalYear: fy },
      order: [["quarter", "ASC"]],
    });
  }

  return targets;
}

export async function updateTarget({ fiscalYear, quarter, targetAmount, notes }) {
  const [target, created] = await Target.findOrCreate({
    where: { fiscalYear, quarter },
    defaults: {
      fiscalYear,
      quarter,
      targetAmount: Number(targetAmount || 0),
      notes: notes || "",
    },
  });

  if (!created) {
    await target.update({
      targetAmount: Number(targetAmount !== undefined ? targetAmount : target.targetAmount),
      notes: notes !== undefined ? notes : target.notes,
    });
  }

  return target;
}

export async function bulkUpdateTargets(targetsList = []) {
  const updated = [];
  for (const item of targetsList) {
    if (item.fiscalYear && item.quarter) {
      const t = await updateTarget(item);
      updated.push(t);
    }
  }
  return updated;
}

