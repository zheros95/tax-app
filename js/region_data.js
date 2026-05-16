/**
 * Historical data for South Korea's Adjustment Target Areas (조정대상지역)
 */
const ADJUSTED_AREA_HISTORY = [
    {
        name: '서울 강남/서초/송파/용산',
        districts: ['강남구', '서초구', '송파구', '용산구'],
        city: '서울',
        periods: [{ start: '2017-08-03', end: null }]
    },
    {
        name: '서울 그 외 21개 구',
        city: '서울',
        districts: ['강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구', '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '성동구', '성북구', '양천구', '영등포구', '은평구', '종로구', '중구', '중랑구'],
        periods: [
            { start: '2017-08-03', end: '2023-01-05' },
            { start: '2025-10-16', end: null }
        ]
    },
    {
        name: '과천, 하남, 광명',
        city: '경기',
        districts: ['과천시', '하남시', '광명시'],
        periods: [
            { start: '2017-08-03', end: '2023-01-05' },
            { start: '2025-10-16', end: null }
        ]
    },
    {
        name: '성남 분당/수정',
        city: '경기',
        districts: ['성남시 분당구', '성남시 수정구'],
        periods: [
            { start: '2017-08-03', end: '2023-01-05' },
            { start: '2025-10-16', end: null }
        ]
    },
    {
        name: '성남 중원',
        city: '경기',
        districts: ['성남시 중원구'],
        periods: [
            { start: '2020-02-21', end: '2022-11-14' },
            { start: '2025-10-16', end: null }
        ]
    },
    {
        name: '수원 팔달, 영통, Jangan, 안양 동안, 용인 수지, 의왕',
        city: '경기',
        districts: ['수원시 팔달구', '수원시 영통구', '수원시 장안구', '안양시 동안구', '용인시 수지구', '의왕시'],
        periods: [
            { start: '2018-08-28', end: '2022-11-14' }, // Simplified date for this group
            { start: '2025-10-16', end: null }
        ]
    },
    {
        name: '수원 권선, 안양 만안, 용인 기흥',
        city: '경기',
        districts: ['수원시 권선구', '안양시 만안구', '용인시 기흥구'],
        periods: [{ start: '2020-02-21', end: '2022-11-14' }]
    },
    {
        name: '구리, 군포, 의정부, 안산 단원, 부천, 시흥, 오산, 평택, 광주, 양주',
        city: '경기',
        districts: ['구리시', '군포시', '의정부시', '안산시 단원구', '부천시', '시흥시', '오산시', '평택시', '광주시', '양주시'],
        periods: [{ start: '2020-06-19', end: '2022-09-26' }]
    },
    {
        name: '김포, 파주',
        city: '경기',
        districts: ['김포시', '파주시'],
        periods: [{ start: '2020-11-20', end: '2022-09-26' }]
    },
    {
        name: '인천 8개 구',
        city: '인천',
        districts: ['중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구'],
        periods: [{ start: '2020-06-19', end: '2022-09-26' }]
    },
    {
        name: '부산 해운대, 수영, 동래',
        city: '부산',
        districts: ['해운대구', '수영구', '동래구'],
        periods: [
            { start: '2017-08-03', end: '2019-11-08' },
            { start: '2020-11-20', end: '2022-09-26' }
        ]
    },
    {
        name: '부산 남구, 연제구',
        city: '부산',
        districts: ['남구', '연제구'],
        periods: [
            { start: '2017-08-03', end: '2018-12-31' },
            { start: '2020-11-20', end: '2022-09-26' }
        ]
    },
    {
        name: '부산 기타 (서, 동, 영도, 부산진, 금정, 북, 강서, 사상, 사하)',
        city: '부산',
        districts: ['서구', '동구', '영도구', '부산진구', '금정구', '북구', '강서구', '사상구', '사하구'],
        periods: [{ start: '2020-12-18', end: '2022-09-26' }]
    },
    {
        name: '대구 수성구',
        city: '대구',
        districts: ['수성구'],
        periods: [{ start: '2020-11-20', end: '2022-09-26' }]
    },
    {
        name: '세종',
        city: '세종',
        districts: ['세종특별자치시'],
        periods: [{ start: '2016-11-03', end: '2022-09-26' }]
    }
];
