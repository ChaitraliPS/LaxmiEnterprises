import { Client } from "../models/Client.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getReceivables } from "../services/metrics/salesMetrics.js";
import { getToday, canonicalClientType } from "../constants/erpConstants.js";

/**
 * Get all clients with real billing totals, orders, and dues computed from invoices
 */
export const getClients = asyncHandler(async (req, res) => {
  const { clientType } = req.query;
  const where = {};

  if (clientType && clientType !== "All") {
    where.clientType = clientType;
  }

  const [clients, receivablesData] = await Promise.all([
    Client.findAll({ where, order: [["clientId", "ASC"]] }),
    getReceivables(getToday()),
  ]);

  const recMap = new Map(receivablesData.clientBreakdown.map((c) => [c.clientId, c]));

  const payload = clients.map((c) => {
    const json = c.toJSON();
    const metrics = recMap.get(c.clientId);

    const revenue = metrics ? metrics.totalInvoiced : Number(c.revenue || 0);
    const orders = metrics ? metrics.invoiceCount : Number(c.orders || 0);
    const outstanding = metrics ? metrics.outstanding : Number(c.outstandingBalance || 0);

    return {
      ...json,
      revenue,
      totalBilled: revenue,
      orders,
      outstandingBalance: outstanding,
      outstanding,
      clientType: canonicalClientType(c.clientType),
    };
  });

  return ApiResponse.success(res, payload, "Clients retrieved successfully");
});

/**
 * Get single client by clientId
 */
export const getClientById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const client = await Client.findOne({
    where: { clientId: id },
  });

  if (!client) {
    throw ApiError.notFound(`Client not found with id: ${id}`);
  }

  const receivablesData = await getReceivables(getToday());
  const metrics = receivablesData.clientBreakdown.find((c) => c.clientId === client.clientId);

  const json = client.toJSON();
  return ApiResponse.success(
    res,
    {
      ...json,
      revenue: metrics ? metrics.totalInvoiced : Number(client.revenue || 0),
      orders: metrics ? metrics.invoiceCount : Number(client.orders || 0),
      outstandingBalance: metrics ? metrics.outstanding : Number(client.outstandingBalance || 0),
      clientType: canonicalClientType(client.clientType),
    },
    "Client retrieved successfully"
  );
});

/**
 * Create a new client
 */
export const createClient = asyncHandler(async (req, res) => {
  const clientData = { ...req.body };

  if (!clientData.clientId) {
    const count = await Client.count();
    clientData.clientId = `CL-${String(count + 1).padStart(3, "0")}`;
  }

  const existing = await Client.findOne({ where: { clientId: clientData.clientId } });
  if (existing) {
    throw ApiError.badRequest(`Client ID ${clientData.clientId} already exists`);
  }

  clientData.clientType = canonicalClientType(clientData.clientType);
  if (!clientData.paymentTerms) {
    clientData.paymentTerms = "Net 30";
  }

  const client = await Client.create(clientData);
  return ApiResponse.created(res, client, "Client created successfully");
});

/**
 * Update an existing client
 */
export const updateClient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const client = await Client.findOne({ where: { clientId: id } });

  if (!client) {
    throw ApiError.notFound(`Client not found with id: ${id}`);
  }

  const body = { ...req.body };
  if (body.clientType) {
    body.clientType = canonicalClientType(body.clientType);
  }

  await client.update(body);
  return ApiResponse.success(res, client, "Client updated successfully");
});

/**
 * Delete a client
 */
export const deleteClient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const client = await Client.findOne({ where: { clientId: id } });

  if (!client) {
    throw ApiError.notFound(`Client not found with id: ${id}`);
  }

  await client.destroy();
  return ApiResponse.success(res, null, "Client deleted successfully");
});
