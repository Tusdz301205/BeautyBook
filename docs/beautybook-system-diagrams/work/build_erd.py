from diagram_engine import Diagram

# Conceptual ERD: entities and named relationships; detailed attributes stay in
# the existing logical/physical data model sheets.
def segment(d,pts,card,position):
    d.edge(pts,start=card,start_pos=position)

def make_erd():
    d=Diagram('17_erd_co_so_dich_vu',960,1020)
    for id,label,x,y in [
        ('owner','Chủ cơ sở',150,100),('business','Doanh nghiệp',810,100),
        ('catalog','Dịch vụ\ndoanh nghiệp',150,440),('branch','Chi nhánh',810,440),
        ('offering','Dịch vụ tại\nchi nhánh',150,780),('staff','Nhân viên',810,780)]:
        d.entity(id,label,x,y)
    for id,label,x,y in [
        ('own','Sở hữu',480,100),('define','Xây dựng',480,270),('has_branch','Gồm',810,270),
        ('deploy','Triển khai',150,610),('provide','Cung cấp',480,610),('employ','Quản lý',810,610),
        ('skill','Có năng lực\nthực hiện',480,780)]:d.diamond(id,label,x,y)
    segment(d,[(270,100),(390,100)],'1',(295,70))
    segment(d,[(930-240,100),(570,100)],'0..*',(655,70))
    segment(d,[(700,138),(700,270),(570,270)],'1',(720,157))
    segment(d,[(150,402),(150,270),(390,270)],'0..*',(180,370))
    segment(d,[(810,138),(810,215)],'1',(835,150))
    segment(d,[(810,402),(810,325)],'0..*',(842,370))
    segment(d,[(150,478),(150,555)],'1',(177,490))
    segment(d,[(150,742),(150,665)],'0..*',(180,710))
    segment(d,[(700,478),(700,610),(570,610)],'1',(723,490))
    segment(d,[(260,742),(260,610),(390,610)],'0..*',(292,710))
    segment(d,[(810,478),(810,555)],'1',(835,490))
    segment(d,[(810,742),(810,665)],'0..*',(842,710))
    segment(d,[(270,780),(390,780)],'0..*',(304,750))
    segment(d,[(690,780),(570,780)],'0..*',(655,750))
    d.note('Hình chữ nhật: thực thể     Hình thoi: quan hệ',480,900,20)
    d.note('Bội số tại một đầu cho biết số thực thể có thể có ở đầu đó.',480,940,19)
    first=d.save()

    d=Diagram('18_erd_dat_lich_danh_gia',960,1020)
    for id,label,x,y in [
        ('customer','Khách hàng',150,100),('booking','Lịch hẹn',810,100),
        ('review','Đánh giá',150,440),('item','Chi tiết\nlịch hẹn',810,440),
        ('offering','Dịch vụ tại\nchi nhánh',150,780),('staff','Nhân viên',810,780)]:
        d.entity(id,label,x,y)
    for id,label,x,y in [
        ('book','Đặt',480,100),('feedback','Có đánh giá',480,270),('contains','Bao gồm',810,270),
        ('choose','Được chọn\ntrong',480,610),('serve','Thực hiện',810,610)]:d.diamond(id,label,x,y)
    segment(d,[(270,100),(390,100)],'1',(295,70))
    segment(d,[(690,100),(570,100)],'0..*',(655,70))
    segment(d,[(700,138),(700,270),(570,270)],'1',(723,157))
    segment(d,[(150,402),(150,270),(390,270)],'0..1',(183,370))
    segment(d,[(810,138),(810,215)],'1',(835,150))
    segment(d,[(810,402),(810,325)],'1..*',(843,370))
    segment(d,[(700,478),(700,610),(570,610)],'0..*',(731,490))
    segment(d,[(150,742),(150,610),(390,610)],'1',(177,710))
    segment(d,[(810,478),(810,555)],'0..*',(845,490))
    segment(d,[(810,742),(810,665)],'0..1',(845,710))
    d.note('Chi tiết lịch hẹn tương ứng với từng dòng booking_services.',480,900,20)
    d.note('Dịch vụ tại chi nhánh và Nhân viên nối với phần ERD cơ sở.',480,940,19)
    return [first,d.save()]
