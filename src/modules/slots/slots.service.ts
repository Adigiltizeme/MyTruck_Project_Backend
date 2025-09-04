import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface SlotAvailability {
    date: string;
    slot: any;
    isAvailable: boolean;
    reason?: string;
    bookingsCount: number;
    maxCapacity: number;
}

@Injectable()
export class SlotsService {
    constructor(private prisma: PrismaService) {
        this.initializeDefaultSlots();
    }

    // 🚀 INITIALISATION DES CRÉNEAUX PAR DÉFAUT
    private async initializeDefaultSlots() {
        try {
            const existingSlots = await this.prisma.timeSlot.count();

            if (existingSlots === 0) {
                console.log('🚀 Initialisation des créneaux par défaut...');

                const defaultSlots = [
                    { startTime: '07h', endTime: '09h', displayName: '07h-09h' },
                    { startTime: '08h', endTime: '10h', displayName: '08h-10h' },
                    { startTime: '09h', endTime: '11h', displayName: '09h-11h' },
                    { startTime: '10h', endTime: '12h', displayName: '10h-12h' },
                    { startTime: '11h', endTime: '13h', displayName: '11h-13h' },
                    { startTime: '12h', endTime: '14h', displayName: '12h-14h' },
                    { startTime: '13h', endTime: '15h', displayName: '13h-15h' },
                    { startTime: '14h', endTime: '16h', displayName: '14h-16h' },
                    { startTime: '15h', endTime: '17h', displayName: '15h-17h' },
                    { startTime: '16h', endTime: '18h', displayName: '16h-18h' },
                    { startTime: '17h', endTime: '19h', displayName: '17h-19h' },
                    { startTime: '18h', endTime: '20h', displayName: '18h-20h' }
                ];

                for (const slot of defaultSlots) {
                    await this.prisma.timeSlot.create({
                        data: {
                            ...slot,
                            isActive: true,
                            maxCapacity: 10
                        }
                    });
                }

                console.log('✅ Créneaux par défaut initialisés');
            }
        } catch (error) {
            console.error('❌ Erreur initialisation créneaux:', error);
        }
    }

    // 📋 RÉCUPÉRER TOUS LES CRÉNEAUX
    async findAll() {
        return this.prisma.timeSlot.findMany({
            orderBy: { startTime: 'asc' },
            include: {
                restrictions: {
                    where: {
                        isBlocked: true,
                        OR: [
                            { temporaryUntil: null },
                            { temporaryUntil: { gte: new Date() } }
                        ]
                    }
                }
            }
        });
    }

    // 🆕 CRÉER UN NOUVEAU CRÉNEAU
    async create(createTimeSlotDto: any) {
        // Vérifier que le créneau n'existe pas déjà
        const existing = await this.prisma.timeSlot.findFirst({
            where: { displayName: createTimeSlotDto.displayName }
        });

        if (existing) {
            throw new BadRequestException('Ce créneau existe déjà');
        }

        return this.prisma.timeSlot.create({
            data: createTimeSlotDto
        });
    }

    // 🔄 METTRE À JOUR UN CRÉNEAU
    async update(id: string, updateTimeSlotDto: any) {
        console.log('🔄 Service update - ID:', id, 'Data:', updateTimeSlotDto);

        // 🔧 Validation simple de l'ID
        if (!id || id.length < 10) {
            throw new BadRequestException('ID créneau invalide');
        }

        const slot = await this.prisma.timeSlot.findUnique({ where: { id } });

        if (!slot) {
            throw new NotFoundException('Créneau non trouvé');
        }

        // 🔧 Nettoyer les données reçues
        const cleanData: any = {};

        if (updateTimeSlotDto.isActive !== undefined) {
            cleanData.isActive = Boolean(updateTimeSlotDto.isActive);
        }

        if (updateTimeSlotDto.maxCapacity !== undefined) {
            const capacity = parseInt(String(updateTimeSlotDto.maxCapacity));
            if (capacity >= 1 && capacity <= 50) {
                cleanData.maxCapacity = capacity;
            }
        }

        if (updateTimeSlotDto.startTime) {
            cleanData.startTime = updateTimeSlotDto.startTime;
        }

        if (updateTimeSlotDto.endTime) {
            cleanData.endTime = updateTimeSlotDto.endTime;
        }

        if (updateTimeSlotDto.displayName) {
            cleanData.displayName = updateTimeSlotDto.displayName;
        }

        console.log('🧹 Données nettoyées:', cleanData);

        const result = await this.prisma.timeSlot.update({
            where: { id },
            data: cleanData
        });

        console.log('✅ Créneau mis à jour:', result);
        return result;
    }

    // 🗑️ SUPPRIMER UN CRÉNEAU
    async remove(id: string) {
        if (!id || id.length < 10) {
            throw new BadRequestException('ID créneau invalide');
        }

        const slot = await this.prisma.timeSlot.findUnique({ where: { id } });

        if (!slot) {
            throw new NotFoundException('Créneau non trouvé');
        }

        // Vérifier qu'aucune commande n'utilise ce créneau
        const commandesCount = await this.prisma.commande.count({
            where: { timeSlotId: id }
        });

        if (commandesCount > 0) {
            throw new BadRequestException('Impossible de supprimer : des commandes utilisent ce créneau');
        }

        return this.prisma.timeSlot.delete({ where: { id } });
    }

    // 📅 DISPONIBILITÉ POUR UNE DATE
    async getAvailabilityForDate(date: string): Promise<SlotAvailability[]> {
        console.log(`🔍 Calcul disponibilité pour ${date}`);

        // Récupérer tous les créneaux actifs
        const slots = await this.prisma.timeSlot.findMany({
            where: { isActive: true },
            orderBy: { startTime: 'asc' }
        });

        // Récupérer les restrictions pour cette date
        const restrictions = await this.prisma.slotRestriction.findMany({
            where: {
                date,
                isBlocked: true,
                OR: [
                    { temporaryUntil: null },
                    { temporaryUntil: { gte: new Date() } }
                ]
            }
        });

        // Compter les réservations existantes
        const bookings = await this.prisma.commande.groupBy({
            by: ['timeSlotId'],
            where: {
                dateLivraison: {
                    gte: new Date(`${date}T00:00:00.000Z`),
                    lt: new Date(`${date}T23:59:59.999Z`)
                },
                timeSlotId: { not: null }
            },
            _count: { id: true }
        });

        const bookingsMap = new Map(
            bookings.map(b => [b.timeSlotId, b._count.id])
        );

        // Calculer la disponibilité pour chaque créneau
        const availability: SlotAvailability[] = slots.map(slot => {
            const restriction = restrictions.find(r => r.slotId === slot.id);
            const bookingsCount = bookingsMap.get(slot.id) || 0;
            const isSlotPassed = this.isSlotPassed(date, slot.endTime);

            let isAvailable = true;
            let reason: string | undefined;

            // Vérifier si le créneau est passé
            if (isSlotPassed) {
                isAvailable = false;
                reason = 'Créneau passé';
            }
            // Vérifier les restrictions admin
            else if (restriction) {
                isAvailable = false;
                reason = restriction.reason || 'Bloqué par administration';
            }
            // Vérifier la capacité maximale
            else if (bookingsCount >= slot.maxCapacity) {
                isAvailable = false;
                reason = 'Capacité maximale atteinte';
            }

            return {
                date,
                slot,
                isAvailable,
                reason,
                bookingsCount,
                maxCapacity: slot.maxCapacity
            };
        });

        console.log(`📊 Disponibilité calculée: ${availability.filter(a => a.isAvailable).length}/${availability.length} créneaux disponibles`);

        return availability;
    }

    // ⏰ VÉRIFIER SI UN CRÉNEAU EST PASSÉ
    private isSlotPassed(date: string, endTime: string): boolean {
        const today = new Date().toISOString().split('T')[0];
        if (date !== today) return false;

        const currentHour = new Date().getHours();
        const slotEndHour = parseInt(endTime.replace('h', ''));
        return currentHour >= slotEndHour;
    }

    // 🚫 BLOQUER UN CRÉNEAU
    async createRestriction(createRestrictionDto: any, userId: string) {
        console.log('📝 Création restriction DB:', { createRestrictionDto, userId });

        // Vérifier que l'utilisateur existe
        const user = await this.prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new NotFoundException('Utilisateur non trouvé');
        }

        // Vérifier que le slot existe
        const slot = await this.prisma.timeSlot.findUnique({
            where: { id: createRestrictionDto.slotId }
        });

        if (!slot) {
            throw new NotFoundException('Créneau non trouvé');
        }

        // Créer ou mettre à jour la restriction
        const restriction = await this.prisma.slotRestriction.upsert({
            where: {
                date_slotId: {
                    date: createRestrictionDto.date,
                    slotId: createRestrictionDto.slotId
                }
            },
            update: {
                isBlocked: createRestrictionDto.isBlocked ?? true,
                reason: createRestrictionDto.reason,
                blockedBy: userId,
                blockedAt: new Date(),
                temporaryUntil: createRestrictionDto.temporaryUntil
                    ? new Date(createRestrictionDto.temporaryUntil)
                    : null
            },
            create: {
                date: createRestrictionDto.date,
                slotId: createRestrictionDto.slotId,
                isBlocked: createRestrictionDto.isBlocked ?? true,
                reason: createRestrictionDto.reason,
                blockedBy: userId,
                blockedAt: new Date(),
                temporaryUntil: createRestrictionDto.temporaryUntil
                    ? new Date(createRestrictionDto.temporaryUntil)
                    : null
            }
        });

        console.log('✅ Restriction créée:', restriction.id);
        return restriction;
    }

    // ✅ DÉBLOQUER UN CRÉNEAU
    async removeRestriction(date: string, slotId: string) {
        console.log('🗑️ Service removeRestriction:', { date, slotId });

        if (!slotId || slotId.length < 10) {
            throw new BadRequestException('slotId invalide');
        }

        const restriction = await this.prisma.slotRestriction.findUnique({
            where: {
                date_slotId: { date, slotId }
            }
        });

        if (!restriction) {
            throw new NotFoundException('Restriction non trouvée');
        }

        const result = await this.prisma.slotRestriction.delete({
            where: { id: restriction.id }
        });

        console.log('✅ Restriction supprimée');
        return result;
    }

    // 📊 RÉCUPÉRER LES RESTRICTIONS ACTIVES
    async getActiveRestrictions(startDate?: string, endDate?: string) {
        const where: any = {
            isBlocked: true,
            OR: [
                { temporaryUntil: null },
                { temporaryUntil: { gte: new Date() } }
            ]
        };

        if (startDate && endDate) {
            where.date = {
                gte: startDate,
                lte: endDate
            };
        } else if (startDate) {
            where.date = { gte: startDate };
        } else if (endDate) {
            where.date = { lte: endDate };
        }

        return this.prisma.slotRestriction.findMany({
            where,
            include: {
                slot: true,
                blockedByUser: {
                    select: { nom: true, prenom: true }
                }
            },
            orderBy: [{ date: 'asc' }, { slot: { startTime: 'asc' } }]
        });
    }

    // 🧹 NETTOYER LES RESTRICTIONS EXPIRÉES
    async cleanupExpiredRestrictions() {
        const now = new Date();

        const result = await this.prisma.slotRestriction.deleteMany({
            where: {
                temporaryUntil: {
                    lt: now
                }
            }
        });

        console.log(`🧹 ${result.count} restrictions expirées supprimées`);
        return result;
    }
}
