import { Test, TestingModule } from '@nestjs/testing';
import { SlotsService } from './slots.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('SlotsService', () => {
    let service: SlotsService;
    let prisma: PrismaService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SlotsService,
                {
                    provide: PrismaService,
                    useValue: {
                        timeSlot: {
                            findMany: jest.fn(),
                            findUnique: jest.fn(),
                            create: jest.fn(),
                            update: jest.fn(),
                            delete: jest.fn(),
                            count: jest.fn()
                        },
                        slotRestriction: {
                            findMany: jest.fn(),
                            findUnique: jest.fn(),
                            create: jest.fn(),
                            update: jest.fn(),
                            delete: jest.fn(),
                            deleteMany: jest.fn()
                        },
                        commande: {
                            groupBy: jest.fn(),
                            count: jest.fn()
                        }
                    }
                }
            ]
        }).compile();

        service = module.get<SlotsService>(SlotsService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getAvailabilityForDate', () => {
        it('should return availability for a date', async () => {
            const mockSlots = [
                {
                    id: '1',
                    startTime: '07h',
                    endTime: '09h',
                    displayName: '07h-09h',
                    isActive: true,
                    maxCapacity: 10,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];

            jest.spyOn(prisma.timeSlot, 'findMany').mockResolvedValue(mockSlots);
            jest.spyOn(prisma.slotRestriction, 'findMany').mockResolvedValue([]);

            const result = await service.getAvailabilityForDate('2025-12-25');

            expect(result).toHaveLength(1);
            expect(result[0].isAvailable).toBe(true);
            expect(result[0].bookingsCount).toBe(0);
        });
    });

    describe('createRestriction', () => {
        it('should create a new restriction', async () => {
            const mockSlot = {
                id: '1',
                startTime: '07h',
                endTime: '09h',
                displayName: '07h-09h',
                isActive: true,
                maxCapacity: 10,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const restrictionDto = {
                date: '2025-12-25',
                slotId: '1',
                isBlocked: true,
                reason: 'Maintenance'
            };

            jest.spyOn(prisma.timeSlot, 'findUnique').mockResolvedValue(mockSlot);
            jest.spyOn(prisma.slotRestriction, 'findUnique').mockResolvedValue(null);
            jest.spyOn(prisma.slotRestriction, 'create').mockResolvedValue({
                id: '1',
                ...restrictionDto,
                blockedBy: 'user1',
                blockedAt: new Date(),
                temporaryUntil: null,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            const result = await service.createRestriction(restrictionDto, 'user1');

            expect(result).toBeDefined();
            expect(result.reason).toBe('Maintenance');
        });
    });
});