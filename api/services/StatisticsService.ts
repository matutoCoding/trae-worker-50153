import { StatisticsRepository } from '../repositories/StatisticsRepository.js'
import { FamilyRepository } from '../repositories/FamilyRepository.js'
import type { DurationStats, MemberRanking } from '../../shared/types.js'

export const StatisticsService = {
  getDurationStats(
    userId: string,
    startDate: string,
    endDate: string,
  ): DurationStats[] {
    const member = FamilyRepository.findMemberById(userId)
    if (!member) {
      throw new Error('用户不存在')
    }

    return StatisticsRepository.getDurationStatsByFamily(
      member.familyId,
      startDate,
      endDate,
    )
  },

  getDurationStatsByFamily(
    familyId: string,
    startDate: string,
    endDate: string,
  ): DurationStats[] {
    const account = FamilyRepository.findAccountById(familyId)
    if (!account) {
      throw new Error('家庭账户不存在')
    }

    return StatisticsRepository.getDurationStatsByFamily(familyId, startDate, endDate)
  },

  getMemberRanking(
    userId: string,
    startDate: string,
    endDate: string,
  ): MemberRanking[] {
    const member = FamilyRepository.findMemberById(userId)
    if (!member) {
      throw new Error('用户不存在')
    }

    return StatisticsRepository.getMemberRanking(
      member.familyId,
      startDate,
      endDate,
    )
  },

  getMemberRankingByFamily(
    familyId: string,
    startDate: string,
    endDate: string,
  ): MemberRanking[] {
    const account = FamilyRepository.findAccountById(familyId)
    if (!account) {
      throw new Error('家庭账户不存在')
    }

    return StatisticsRepository.getMemberRanking(familyId, startDate, endDate)
  },
}
