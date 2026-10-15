import { z } from "zod";

export const attendanceSchema = z.object({
  fullName: z.string().trim().min(3, "Nama minimal 3 karakter.").max(100, "Nama maksimal 100 karakter."),
  villageId: z.coerce.number().int().positive("Pilih desa terlebih dahulu."),
  groupId: z.coerce.number().int().positive("Pilih kelompok terlebih dahulu."),
  age: z.coerce.number().int().min(5, "Umur minimal 5 tahun.").max(100, "Umur maksimal 100 tahun."),
  gender: z.enum(["male", "female"], "Pilih jenis kelamin."),
  occupation: z.string().trim().min(1, "Pekerjaan wajib diisi.").max(100, "Pekerjaan maksimal 100 karakter."),
});

export const eventSchema = z.object({
  name: z.string().trim().min(3).max(120),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eventTime: z.string().regex(/^\d{2}:\d{2}$/),
  location: z.string().trim().min(2).max(160),
  description: z.string().trim().max(500).optional().nullable(),
  status: z.enum(["draft", "active", "finished"]).default("draft"),
});

export const villageSchema = z.object({
  name: z.string().trim().min(2).max(80),
  groupNames: z.array(z.string().trim().min(1).max(80)).max(100).optional().default([]),
}).superRefine((data, context) => {
  const names = new Set<string>();
  for (const name of data.groupNames) {
    const normalized = name.toLocaleLowerCase("id-ID");
    if (names.has(normalized)) {
      context.addIssue({ code: "custom", message: "Nama kelompok tidak boleh berulang.", path: ["groupNames"] });
      return;
    }
    names.add(normalized);
  }
});
export const groupSchema = z.object({ name: z.string().trim().min(1).max(80), villageId: z.coerce.number().int().positive() });
export const loginSchema = z.object({ username: z.string().trim().min(1).max(120), password: z.string().min(1).max(200) });
export const passwordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(10, "Kata sandi baru minimal 10 karakter.").max(200) });
