import { PrismaClient } from '@prisma/client';
import { scraperQueue } from '../queues/scraper.queue';

const prisma = new PrismaClient();

const FIRST_NAMES = new Set([
  'annie','anton','anuja','april','arely','ariel','arjun','baldo','belen','belma',
  'berto','betsy','bonny','boris','brisa','buddy','caleb','candy','carla','casey',
  'cathy','cecil','celia','chava','chloe','chris','chuck','cielo','cindy','clara',
  'clare','clint','clyde','corey','cyril','cyrus','dalia','damon','danny','dante',
  'daren','darla','darcy','daryl','debby','deepa','deion','della','delia','denis',
  'derek','devin','devon','dewey','diego','dolly','donna','doris','drake','dulce',
  'dusty','dwain','dylan','earle','ebony','eddie','edgar','edwin','efren','eldon',
  'elena','elisa','elise','ellie','elsie','elton','elvis','emery','emile','emily',
  'erica','ernie','ervin','essie','ethan','ethel','faith','fanny','felix','fidel',
  'fiona','floyd','flynn','frank','fritz','frida','garry','gavin','gemma','gerri',
  'ginny','glenn','gopal','grace','greta','gregg','haley','hanna','hazel','heath',
  'heidi','helen','henry','holly','homer','huber','ilene','irene','ivory','isaac',
  'isael','jaime','janie','janet','janis','jared','jason','jenna','jenny','jesse',
  'jewel','jimmy','johan','jonas','jorge','josef','juana','jules','julia','julie',
  'jyoti','karen','karin','katie','kavya','kayla','keith','kelly','kenny','kevin',
  'kirby','klaus','lacey','laila','lance','larry','layne','leigh','lenny','leroy',
  'lilly','linda','linus','logan','lonny','loren','lorna','louis','lucas','lucia',
  'luisa','luigi','lydia','lynda','mabel','macie','madge','mandy','manny','marco',
  'marge','marie','mario','marla','mason','mateo','maude','maura','meena','megan',
  'mercy','merry','midge','miley','miles','millie','mindy','mirna','misty','mitch',
  'mohan','moira','molly','monte','monty','moses','myrna','nabil','nadia','nancy',
  'naomi','neha','nelly','nesta','nigel','nicky','nikki','nilda','nisha','nitin',
  'nolan','norma','olive','oscar','pablo','paige','pansy','patsy','patty','paula',
  'pavan','pearl','pedro','peggy','penny','percy','perry','peter','pooja','polly',
  'priya','queen','radha','randi','randy','raoul','raven','reece','reema','reina',
  'renee','rhoda','ricky','riley','robin','rocio','rocky','roger','roman','ronda',
  'rosie','rowan','roxie','royal','rufus','rusty','sadie','sagar','sally','sandy',
  'sarah','scott','seema','selma','serge','shane','shana','shari','shawn','sheri',
  'simon','sonia','sonja','sonya','sonny','stacy','starr','steve','sunil','suraj',
  'susie','swati','tammy','tamra','tanya','tasha','teddy','terri','terry','tessa',
  'theda','tiana','tisha','titus','tommy','tonya','trace','trent','trish','trudy',
  'tyler','tyson','vance','varun','vicki','vidal','vijay','vikki','vince','viola',
  'vivek','wally','wanda','wayne','wendy','wyatt','wylie','zelda','zelma',
]);

const LAST_NAMES = new Set([
  'adams','baker','black','blair','bland','booth','bowen','bowie','bragg','brand',
  'brant','braun','breen','brent','brock','bruce','bruno','burke','bynum','byrne',
  'cable','cagle','cantu','carey','cheng','chung','cline','close','coats','cohen',
  'combs','cooke','cosby','costa','couch','crane','cross','crowe','curry','david',
  'davis','dietz','dixon','doyle','duffy','dunne','dwyer','early','eaton','ellis',
  'engel','ennis','ernst','evans','ewing','faulk','field','finch','flagg','flood',
  'foley','frost','fuchs','garza','gibbs','glass','gomez','gould','graff','grant',
  'greer','gross','gupta','hagen','hardy','harms','hatch','haven','hayes','hicks',
  'hobbs','hodge','hogan','horne','houck','hurst','irwin','james','johns','jones',
  'joyce','judge','kemp','kline','knapp','knott','kraft','kraus','lacey','lange',
  'larue','lauer','leach','leeds','levey','lewis','lloyd','lopez','lucio','lynch',
  'lyons','mahan','maher','malik','marsh','mason','matos','mayes','mayor','meyer',
  'mills','minor','moody','moore','moran','morse','moser','mount','moyer','munoz',
  'myers','nagel','nance','naqvi','nason','navra','neill','north','novak','nunez',
  'oakes','ochoa','ogden','olsen','ortiz','owens','paine','pardo','parks','patel',
  'payne','peace','pence','perez','petty','piper','pitts','plant','platt','poole',
  'power','pratt','price','prine','pryor','quinn','rains','ramos','reese','reeve',
  'reyes','ricks','riggs','riley','rivas','roach','roche','roper','rosen','rouse',
  'rubio','rubin','russo','sager','salas','sales','sands','sayre','sears','selby',
  'sells','sharp','sheen','short','silva','singh','sloan','small','smith','snell',
  'solis','spear','stack','stein','stern','stock','stout','stowe','suggs','swain',
  'sweet','swift','sykes','tapia','terry','thiel','tobin','torre','trejo','tripp',
  'truax','tubbs','tyler','urban','usher','varga','villa','vogel','wages','walls',
  'walsh','watts','weber','wells','welsh','wendt','white','wiley','wolfe','wolff',
  'woods','worth','wyman','yanez','young','zhang',
  'acuna','adame','anaya','avila','baeza','banda','bello','bosco','bravo','bueno',
  'calvo','campo','casas','cerda','chapa','coria','corzo','duran','garzo','lerma',
  'llano','loera','lujan','mares','marin','mejia','mendo','milla','monje','nieto',
  'oliva','ozuna','parra','ponce','reyna','rocha','rojas','roque','saenz','serna',
  'tamez','tello','tovar','uribe','valde','valez','viera',
  'bajaj','bhatt','batra','dixit','joshi','kapur','kumar','mehta','mehra','misra',
  'nagar','naidu','nanda','pande','reddy','sethi','sinha','sodhi','verma','yadav',
  'chang','hsiao','huang','hwang','jiang','liang','tsang',
]);

const GEOGRAPHIC = new Set([
  'arbor','aspen','basin','bayou','beach','berry','birch','bluff','briar','brook',
  'butte','campo','cedar','chase','cliff','cloud','coast','coral','creek','crest',
  'crown','curve','delta','dover','eagle','falls','fern','field','flame','flint',
  'flora','forge','frost','glade','globe','grace','grand','grass','green','grove',
  'haven','hazel','heath','hedge','heron','hilly','holly','ivory','knoll','larch',
  'lilac','lilly','lodge','lotus','maple','marsh','misty','mound','oasis','olive',
  'onion','otter','peach','pearl','pecan','pines','plain','plant','plaza','point',
  'poppy','quail','ranch','rapid','raven','ridge','river','robin','rocky','royal',
  'sabal','sandy','shade','shore','shoal','slate','slope','spice','spine','spray',
  'stone','storm','sunny','swift','terra','thorn','trace','trail','tulip','valle',
  'verde','vigor','viola','vista','water','wheat','winds','wolfe','woods',
  'alamo','aledo','alice','allen','bryan','cisco','clyde','crane','cuero','donna',
  'eagle','elgin','emory','ennis','freer','hondo','hutto','llano','manor','marfa',
  'mason','mexia','moran','olney','pampa','pecos','plano','tyler','wells',
]);

const BUSINESS = new Set([
  'asset','atlas','build','chain','class','coach','craft','crown','depot','elite',
  'equip','excel','first','fleet','focus','force','globe','grand','haven','homes',
  'house','ideal','index','inner','lease','legal','level','light','local','lodge',
  'logic','major','manor','metro','model','motor','noble','north','oasis','omega',
  'orbit','order','outer','panel','patio','pilot','pixel','plaza','point','power',
  'press','pride','prime','print','probe','pulse','quest','quick','ranch','range',
  'rapid','realm','reign','renew','ridge','rivet','roost','round','route','royal',
  'rural','scale','scope','sharp','shelf','shell','shine','shore','sight','sigma',
  'slate','smart','solar','solid','south','space','spark','spire','stack','stage',
  'stark','state','steel','stone','storm','suite','swift','terra','texas','titan',
  'token','total','tower','trade','trail','trend','triad','trust','ultra','union',
  'unity','upper','urban','valor','vault','venue','verde','verge','vista','vital',
  'watch','wheel','whole','worth',
]);

async function main() {
  // Read the generated terms file
  const fs = await import('fs');
  const terms = fs.readFileSync(__dirname + '/../../data/valid-5char-terms.txt', 'utf-8')
    .split('\n').map(t => t.trim()).filter(t => t.length === 5);

  const firstNames: string[] = [];
  const lastNames: string[] = [];
  const geographic: string[] = [];
  const business: string[] = [];

  for (const term of terms) {
    const lower = term.toLowerCase();
    if (FIRST_NAMES.has(lower)) firstNames.push(term);
    else if (LAST_NAMES.has(lower)) lastNames.push(term);
    else if (GEOGRAPHIC.has(lower)) geographic.push(term);
    else if (BUSINESS.has(lower)) business.push(term);
  }

  const toEnqueue = [
    ...firstNames.slice(0, 50),
    ...lastNames.slice(0, 40),
    ...geographic.slice(0, 20),
    ...business.slice(0, 30),
  ];

  console.log(`Enqueuing: ${firstNames.slice(0,50).length} first, ${lastNames.slice(0,40).length} last, ${geographic.slice(0,20).length} geo, ${business.slice(0,30).length} biz = ${toEnqueue.length} total`);
  console.log(`\nFirst names: ${firstNames.slice(0,50).join(', ')}`);
  console.log(`\nLast names: ${lastNames.slice(0,40).join(', ')}`);
  console.log(`\nGeographic: ${geographic.slice(0,20).join(', ')}`);
  console.log(`\nBusiness: ${business.slice(0,30).join(', ')}`);

  const before = await prisma.property.count({ where: { year: 2025 } });
  console.log(`\nProperties before: ${before.toLocaleString()}`);

  for (const searchTerm of toEnqueue) {
    await scraperQueue.add(
      'scrape-properties',
      { searchTerm, userId: 'category-batch', scheduled: true },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  }

  console.log(`\nEnqueued ${toEnqueue.length} jobs`);
  await scraperQueue.close();
  await prisma.$disconnect();
}

main();
