import { NotificationsService } from './notifications.service';
import { BadRequestException } from '@nestjs/common';

describe('notification Vietnamese text search retains account and filter scope',()=>{
  test('folds name/text before paging and count while preserving exact filters',async()=>{
    const prisma:any={$queryRaw:jest.fn().mockResolvedValue([{id:'own-a'},{id:'own-b'}]),notification:{findMany:jest.fn().mockResolvedValue([]),count:jest.fn().mockResolvedValue(2)}};
    await new NotificationsService(prisma).findByUser('own-user',{search:'  PHÂN   CÔNG ',state:'unread',type:'SYSTEM',severity:'INFO',page:2,limit:1});
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);const sql=prisma.$queryRaw.mock.calls[0][0];
    expect(sql.sql).toContain('user_id');expect(sql.sql).toContain('translate');expect(sql.values).toContain('own-user');expect(sql.values).toContain('%phan cong%');expect(sql.sql).not.toContain('::uuid');
    const args=prisma.notification.findMany.mock.calls[0][0];
    expect(args).toMatchObject({where:{userId:'own-user',isRead:false,type:'SYSTEM',severity:'INFO',id:{in:['own-a','own-b']}},skip:1,take:1});
    expect(prisma.notification.count.mock.calls[0][0].where).toBe(args.where);
  });
  test('literal wildcard characters do not broaden results; no match stays empty',async()=>{
    const prisma:any={$queryRaw:jest.fn().mockResolvedValue([]),notification:{findMany:jest.fn().mockResolvedValue([]),count:jest.fn().mockResolvedValue(0)}};
    await new NotificationsService(prisma).findByUser('own-user',{search:'50%_\\'});
    expect(prisma.$queryRaw.mock.calls[0][0].values).toContain('%50\\%\\_\\\\%');
    expect(prisma.notification.findMany.mock.calls[0][0].where.id).toEqual({in:[]});
  });
  test('empty normalized query does not run SQL lookup',async()=>{
    const prisma:any={$queryRaw:jest.fn(),notification:{findMany:jest.fn().mockResolvedValue([]),count:jest.fn().mockResolvedValue(0)}};
    await new NotificationsService(prisma).findByUser('own-user',{search:'   '});expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
  test.each([['query'],{query:'value'}])('invalid query type rejects before ORM %j',async search=>{
    const prisma:any={$queryRaw:jest.fn(),notification:{findMany:jest.fn()}};
    await expect(new NotificationsService(prisma).findByUser('own-user',{search:search as never})).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();expect(prisma.notification.findMany).not.toHaveBeenCalled();
  });
});
