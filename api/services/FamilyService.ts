import { FamilyRepository } from '../repositories/FamilyRepository.js'
import type { FamilyInfo, FamilyMember, AddMemberRequest } from '../../shared/types.js'

export const FamilyService = {
  getFamilyInfo(familyId: string): FamilyInfo {
    const account = FamilyRepository.findAccountById(familyId)
    if (!account) {
      throw new Error('家庭账户不存在')
    }

    const members = FamilyRepository.findMembersByFamilyId(familyId)

    return {
      account,
      members,
    }
  },

  getFamilyInfoByUserId(userId: string): FamilyInfo {
    const member = FamilyRepository.findMemberById(userId)
    if (!member) {
      throw new Error('用户不存在')
    }

    return this.getFamilyInfo(member.familyId)
  },

  addMember(familyId: string, request: AddMemberRequest): FamilyMember {
    const account = FamilyRepository.findAccountById(familyId)
    if (!account) {
      throw new Error('家庭账户不存在')
    }

    if (!request.name) {
      throw new Error('成员姓名不能为空')
    }
    if (!['owner', 'member'].includes(request.role)) {
      throw new Error('无效的成员角色')
    }

    return FamilyRepository.addMember(familyId, request)
  },

  removeMember(familyId: string, memberId: string): void {
    const account = FamilyRepository.findAccountById(familyId)
    if (!account) {
      throw new Error('家庭账户不存在')
    }

    const member = FamilyRepository.findMemberById(memberId)
    if (!member) {
      throw new Error('成员不存在')
    }
    if (member.familyId !== familyId) {
      throw new Error('该成员不属于此家庭账户')
    }
    if (member.id === account.ownerId) {
      throw new Error('不能移除家庭账户户主')
    }

    FamilyRepository.removeMember(memberId)
  },
}
