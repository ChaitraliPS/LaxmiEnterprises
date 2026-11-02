import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/db.js";

export class ExpoLead extends Model {
  // Maps database columns to the field names the frontend uses
  toJSON() {
    const v = { ...this.get() };
    const extra = v.extraData || {};
    const created = v.createdAt ? new Date(v.createdAt).toISOString().slice(0, 10) : "";
    const out = {
      ...extra,
      ...v,
      id: v.leadId || v.id,
      name: v.visitorName,
      mobile: v.contact,
      remark: v.notes,
      date: extra.visitDate || created,
      whatsappConsent: extra.whatsappConsent !== false,
      whatsappSentAt: extra.whatsappSentAt || null,
      status: v.status === "New" ? "New Lead" : v.status,
    };
    delete out.extraData;
    return out;
  }
}

ExpoLead.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    leadId: {
      type: DataTypes.STRING(60),
      allowNull: false,
      unique: true,
    },
    expoName: {
      type: DataTypes.STRING(150),
      defaultValue: "AgroTech Kisan Mela",
    },
    visitorName: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING(60),
      defaultValue: "Farmers",
    },
    contact: {
      type: DataTypes.STRING(30),
      defaultValue: "",
    },
    email: {
      type: DataTypes.STRING(150),
      defaultValue: "",
    },
    village: {
      type: DataTypes.STRING(120),
      defaultValue: "",
    },
    taluka: {
      type: DataTypes.STRING(120),
      defaultValue: "",
    },
    district: {
      type: DataTypes.STRING(120),
      defaultValue: "",
    },
    cattleCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    feedRequirement: {
      type: DataTypes.STRING(150),
      defaultValue: "",
    },
    equipmentInterest: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    followUpDate: {
      type: DataTypes.STRING(30),
      defaultValue: "",
    },
    status: {
      type: DataTypes.STRING(30),
      defaultValue: "New Lead",
    },
    whatsappBroadcastSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    notes: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
    extraData: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
  },
  {
    sequelize,
    modelName: "ExpoLead",
    tableName: "expo_leads",
    timestamps: true,
  }
);