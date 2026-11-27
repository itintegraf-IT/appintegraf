/** Číselníky z Excel listu Seznamy */

export const INTERFACE_TYPES = [
  "Ethernet RJ45 10/100/1000",
  "Ethernet RJ45 2,5/5/10 Gb",
  "Optika SFP 1 Gb",
  "Optika SFP+ 10 Gb",
  "Optika SFP28 25 Gb",
  "Wi-Fi",
  "LTE/5G",
  "Sériové (RS-232/RS-485)",
  "OPC UA / průmyslová sběrnice (Profinet, Modbus TCP…)",
  "VPN tunel (site-to-site)",
  "VPN vzdálený přístup",
  "Jiné (popište v poznámce)",
] as const;

export const YES_NO = ["Ano", "Ne"] as const;

export const YES_NO_PENDING = ["Ano", "Ne", "Bude doplněno"] as const;

export const ALLOCATION_MODES = [
  "Statická IP",
  "DHCP",
  "DHCP rezervace",
  "Rozsah statických IP",
  "Neví / dohodnout",
] as const;

export const PROTOCOLS = ["TCP", "UDP", "TCP+UDP", "ICMP", "ESP / IPsec", "GRE", "Jiný"] as const;

export const DIRECTIONS = [
  "Příchozí do sítě firmy",
  "Odchozí z naší sítě ven",
  "Obousměrně",
] as const;

export const SOURCE_TARGET_KINDS = [
  "Internet",
  "Interní síť firmy",
  "Servery výrobce / cloud dodavatele",
  "Vzdálený přístup dodavatele",
  "Jiné zařízení dodavatele",
] as const;

export const VALIDITY_OPTIONS = [
  "Trvale",
  "Dočasně (instalace / uvedení do provozu)",
  "Dočasně (servisní zásah)",
] as const;

export const ENCRYPTION_OPTIONS = ["Ano (TLS/SSH/VPN)", "Ne", "Neví"] as const;

export const CONNECTION_TYPES = ["RJ45", "Optika", "Wi-Fi", "LTE", "Kombinace"] as const;

export const DHCP_MODES = ["DHCP", "Statická", "Kombinace"] as const;

export const REMOTE_ACCESS_METHODS = [
  "VPN",
  "AnyDesk",
  "TeamViewer",
  "RDP",
  "SSH",
  "Kombinace",
  "Žádný vzdálený přístup",
] as const;

export const NETWORK_PLACEMENTS = [
  "Kancelářská síť (LAN)",
  "Výrobní / průmyslová síť (OT)",
  "DMZ",
  "Oddělená síť dodavatele",
  "Neví / dohodnout",
] as const;

export const PROTOCOL_CATALOG = [
  { key: "sql", label: "SQL", typicalPorts: "1433 / 3306 / 5432" },
  { key: "rest_api", label: "REST API", typicalPorts: "443" },
  { key: "soap", label: "SOAP", typicalPorts: "80 / 443" },
  { key: "opc_ua", label: "OPC UA", typicalPorts: "4840" },
  { key: "modbus_tcp", label: "Modbus TCP", typicalPorts: "502" },
  { key: "mqtt", label: "MQTT", typicalPorts: "1883 / 8883" },
  { key: "smb", label: "SMB", typicalPorts: "445" },
  { key: "sftp_ftp", label: "SFTP / FTP", typicalPorts: "22 / 21" },
  { key: "other", label: "Jiné (popište)", typicalPorts: "" },
] as const;

export const SECURITY_QUESTIONS = [
  { key: "uses_tls", label: "Používá šifrování TLS" },
  { key: "requires_service_account", label: "Vyžaduje servisní účet" },
  { key: "requires_internet", label: "Vyžaduje přístup do internetu" },
  { key: "requires_admin", label: "Vyžaduje administrátorská oprávnění" },
  { key: "processes_sensitive_data", label: "Zpracovává osobní nebo citlivá data" },
] as const;

export const DOC_CATALOG = [
  { key: "network_schema", label: "Síťové schéma" },
  { key: "technical_docs", label: "Technická dokumentace" },
] as const;

export const CONTACT_ROLES = [
  "Vedoucí projektu",
  "Technik",
  "Obchodník",
  "Servis",
  "Jiné",
] as const;

export const IT_VENDOR_STATUSES = [
  "draft",
  "sent",
  "submitted",
  "in_review",
  "approved",
  "rejected",
  "cancelled",
] as const;

export type ItVendorStatus = (typeof IT_VENDOR_STATUSES)[number];

export const IT_VENDOR_STATUS_LABELS: Record<ItVendorStatus, string> = {
  draft: "Koncept",
  sent: "Odesláno dodavateli",
  submitted: "Vyplněno dodavatelem",
  in_review: "V kontrole IT",
  approved: "Schváleno",
  rejected: "Zamítnuto",
  cancelled: "Zrušeno",
};
