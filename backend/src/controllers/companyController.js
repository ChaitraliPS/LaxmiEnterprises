import { Company } from "../models/Company.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Get company profile
 */
export const getCompanyProfile = asyncHandler(async (req, res) => {
  let [company] = await Company.findOrCreate({
    where: { id: 1 },
    defaults: {
      name: "Laxmi Enterprises",
    },
  });

  const data = {
    ...company.toJSON(),
    bankName: company.bankDetails?.bankName || "",
    bankBranch: company.bankDetails?.bankBranch || "",
    accountNumber: company.bankDetails?.accountNumber || "",
    ifscCode: company.bankDetails?.ifscCode || "",
    accountName: company.bankDetails?.accountName || "",
  };

  return ApiResponse.success(res, data, "Company profile retrieved");
});

/**
 * Update company profile
 */
export const updateCompanyProfile = asyncHandler(async (req, res) => {
  let [company] = await Company.findOrCreate({
    where: { id: 1 },
    defaults: {
      name: "Laxmi Enterprises",
    },
  });

  const comp = req.body;
  const updatedFields = { ...comp };
  if (comp.bankName !== undefined || comp.accountNumber !== undefined || comp.ifscCode !== undefined || comp.bankBranch !== undefined || comp.accountName !== undefined) {
    const cur = company.bankDetails || {};
    updatedFields.bankDetails = {
      bankName: comp.bankName !== undefined ? comp.bankName : (cur.bankName || ""),
      bankBranch: comp.bankBranch !== undefined ? comp.bankBranch : (cur.bankBranch || ""),
      accountNumber: comp.accountNumber !== undefined ? comp.accountNumber : (cur.accountNumber || ""),
      ifscCode: comp.ifscCode !== undefined ? comp.ifscCode : (cur.ifscCode || ""),
      accountName: comp.accountName !== undefined ? comp.accountName : (cur.accountName || ""),
    };
  }

  await company.update(updatedFields);

  const data = {
    ...company.toJSON(),
    bankName: company.bankDetails?.bankName || "",
    bankBranch: company.bankDetails?.bankBranch || "",
    accountNumber: company.bankDetails?.accountNumber || "",
    ifscCode: company.bankDetails?.ifscCode || "",
    accountName: company.bankDetails?.accountName || "",
  };

  return ApiResponse.success(res, data, "Company profile updated successfully");
});
