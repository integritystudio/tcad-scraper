import { vi } from "vitest";

/** Prisma mock factory for claude service tests */
export const createPrismaMock = () => ({
	prisma: {
		$connect: vi.fn(),
		$disconnect: vi.fn(),
		apiUsageLog: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
	},
	prismaReadOnly: {
		$connect: vi.fn(),
		$disconnect: vi.fn(),
	},
});
