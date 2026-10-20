"""Build the two-glyph Cotion wordmark face from Google's OFL Noto Serif KR source."""
from pathlib import Path
import sys,hashlib,json
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter,Options
from fontTools.varLib.instancer import instantiateVariableFont
root=Path(__file__).resolve().parent.parent
source=Path(sys.argv[1])
font=TTFont(source)
subsetter=Subsetter(options=Options());subsetter.populate(text='코션');subsetter.subset(font)
font=instantiateVariableFont(font,{'wght':500},inplace=True)
for record in font['name'].names:
    value={1:'Cotion Title Serif',2:'Regular',3:'CotionTitleSerif-Subset-1',4:'Cotion Title Serif',6:'CotionTitleSerif',16:'Cotion Title Serif',17:'Regular'}.get(record.nameID)
    if value:record.string=value.encode(record.getEncoding())
font.flavor='woff'
target=root/'src/assets/cotion-title.woff';font.save(target)
provenance={'source':'https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifkr/NotoSerifKR%5Bwght%5D.ttf','source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'subset_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'text':'코션','weight':500,'family':'Cotion Title Serif','license':'SIL Open Font License 1.1; see OFL-NotoSerifKR.txt','regenerate':'python scripts/make-title-font.py /path/to/NotoSerifKR.ttf'}
(root/'src/assets/title-font-provenance.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n')
print('Wordmark font:',target.stat().st_size,'bytes')
