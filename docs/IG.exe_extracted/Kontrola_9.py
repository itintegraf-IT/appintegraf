#-*- coding: utf-8 -*-
##-*- coding: iso-8859-2 -*-i
import wx
import os
import string
import time
import csv # create CS
import shelve # ukládání do shelf
import shutil # move file
import xml.etree.ElementTree as ET
import webbrowser # smazat
import Protokoly
import ctypes # chybové hlášky 
#import pdfkit

global CWD # přenesení do dalších funkcí
CWD=os.getcwd() # getcvd vrátí adresu  "current working directory"
  
NT1 =0 # Defaultni vystup:  0= Nahled PDF A5,A6; 1= Tisk PDF; 2 =Nahled HTML A4,A5; 3=Tisk HTML
NT2= 0# Defaultni vystup:  0= Nahled PDF A5,A6; 1= Tisk PDF; 2 =Nahled HTML A4,A5; 3=Tisk HTML
##########################
SetXML={};SetXML4={};
def CteniXML(AdresaXML,JOB):
    tree = ET.parse(AdresaXML)
    root = tree.getroot()
    for child in root:
        SetXML[child.tag] = list (child.attrib.values()) #{'...': [.......],  '...': [......]}
    KROK=SetXML[JOB][1]; CiselNaRoli=SetXML[JOB][2]; CISLIC=SetXML[JOB][3];
    SetXmlL=[KROK,CiselNaRoli,CISLIC]
    #print ("FixXML: ",SetXmlL)
    return SetXmlL

def CreateXML4(SbL, Adresa1):
    root = ET.Element("root"); i=0 
    for kD in SbL: # první cyklus - List
        Ak=kD.keys(); #print (Ak)
        VALUES=kD.values();   #print (VALUES)
        for item in kD:
            #print("Key : {} , Value : {}".format(item,kD[item]))
            #print (item); print (kD[item])
            doc = ET.SubElement(root, item)
            for value in (kD[item]):
                #print (value)
                ET.SubElement(doc, value[0], name=value[1]).text =value[2]
    tree = ET.ElementTree(root)
    tree.write(Adresa1)
#CreateXML4([{"Ak1": [("A","Text1","100"),("B","Text2","200")]},{"Ak2":[("C","Text3","300")]}], CWD+'\\PARAMETRY\\XML123.xml')

def CteniXML4(Adresa):
    tree = ET.parse(Adresa)
    root = tree.getroot()
    for sub in root:
        for ssub in sub:
            #print (ssub.attrib); print (ssub.text); print (ssub.tag)
            SetXML4[ssub.tag] = list (ssub.attrib.items()) 
    return SetXML4
###################################
def ShelveToDict(NazevS,Key):
    VariablesD=shelve.open(CWD +"\\"+NazevS)
    VariablesL=VariablesD[Key]
    VariablesD.close()
    return VariablesL

def DictToShelve(NazevS,Key,ValuesL):
        VariablesD=shelve.open(CWD+"\\"+NazevS)   
        VariablesD[Key] = ValuesL # uložení MinuleD do shelve "VarSettings"
        
def Okno(Nazev): #  wx File Dialog, vyber souboru
    dialog = wx.FileDialog(None, Nazev, style=wx.FD_MULTIPLE | wx.DD_NEW_DIR_BUTTON)
    if dialog.ShowModal() == wx.ID_OK:
        AdresaTXT= dialog.GetPaths() #??????
    dialog.Destroy()
    try:
        print (len(AdresaTXT), " x  txt:")
        return AdresaTXT    
    except: print ("   !Vyber soubory TXT!")

def Deleni3(line): # dělení čísel po 3
    i=1;line3=""
    for a in  line[::-1]: 
        if i==3: a=a+" "; i=0
        i=i+1; line3=line3+a
    line4=line3[::-1]  # revers 
    return (line4)

def RozprcaneKrabice(JOB):# načtení rozdělaných a hotových krabic 
         global Cesta, SerieL, KsL,CisloJizdF,PrvniJizdF, CisloJizd, CISLIC
         ######načtení
         KsL=[]
         SetXmlL=CteniXML(CWD+"\\FixSettings.xml",JOB)# načtení fixních dat
         Variab1L=ShelveToDict("VarSettings",JOB)# první načtení listu Variables
         Adresa=ShelveToDict("VarSettings","ADRESA") #načtení adresy
         SerieL=Variab1L[1]; SerieS= (",".join(SerieL))
         CISLIC=SetXML[JOB][3] #počet číslic
         KsVKr=int(Variab1L[3].replace(",","")); PROD=int(Variab1L[6].replace(",",""));
         PrvniJizd=int(Variab1L[5].replace(",",""));     
         PrvniJizdF=str("{:,}".format(PrvniJizd)).replace(","," ")     
         if JOB=="CD_Vnitro":
             CiselNaRoli=SetXmlL[1] # Fixní
             for i in range (PROD):  KsL.append(0);
         if JOB=="CD_Validator":
             CiselNaRoli=SetXmlL[1] # Fixní
             for i in range (PROD):  KsL.append(0);             
         elif JOB=="CD_POP":
             CiselNaRoli=Variab1L[2]# Variabilní
             for i in range (PROD):  KsL.append(0);
         elif  JOB=="DPB_AVJ":
             CiselNaRoli=SetXmlL[1] # Fixní
             for i in range (PROD):  KsL.append(0);               
         else:pass         
         ######
         RadekL= [] ;  j=0;
         Cesta=(Adresa+'\\REZANI\\'+JOB+"\\")
         
         CisloJizd1=int(Variab1L[5].replace(",",""))+1; CisloJizd=CisloJizd1 # ZADÁNÍ
         CisloJizdHOT=0; CisloJizdOTV_min=CisloJizd1; CisloJizdOTV_PROD =0# v případě že nejsou rozpracované aní hotové krabice
         
         for nazev in os.listdir(Cesta): # Zjištění počtu otevřených krabic
             if nazev.count(".txt")==1: # TXT
                  j=j+1
         if j<PROD and j>1: #  menší počet TXT souborů než je produkcí=problém
             print ("!  Počet TXT neodpovídá počtu podukcí  !")# TXT soubory neodpovídají počtu sérií (např. první řezání)
             return
         elif j<1: #žádný TXT soubor =nová krabice
              print (   "   Nové krabice ")
              for i in range (0, PROD):  # Počty kusu v krab v jednotl. produkcích  KsL =např [12,1,24,4,4,4]
                        TXT=open(Cesta+str(i+1)+'.txt', 'wt')
                        #print ("114: ", PrvniJizdF)
                        #CisloJizdF=str("{:,}".format(PrvniJizdF)).replace(","," ")
                        CisloJizdF=PrvniJizdF
         else: pass
         print()
         #print(CteniXML4(Cesta+'\\Settings.xml').values())
         #print(CteniXML4(Cesta+'\\Settings.xml').keys())
         #print(CteniXML4(Cesta+'\\Settings.xml')["jmeno"])
         #print(CteniXML4(Cesta+'\\Settings.xml')["A"])
         j=0
     
         for nazev in os.listdir(Cesta): # NAČTENÍ CISEL Z OTEVŘENÝCH KRABIC..  Počet TXT= počet produkcí
               CisloJizdOTV=0;
               #print (nazev)
               if nazev.count(".txt")==1: # TXT
                   with open(Cesta+nazev, "r", encoding="utf-8") as f:  # načtení TXT
                         VypisL=f.readlines()#načtení  obsahu otv. krabic  po řádcích do listu
                          #print ("138...",VypisL)
                   RadekL= [] 
                   for radek in VypisL:
                       if radek.count ("|")>=3: RadekL.append(radek)# Odstranění bordelu
                       else: print ("Bordel v datech")
                   
                   if len (RadekL) >=1: # jestliže soubor TXT není prázdný
                       PrvniRadekL=RadekL[0].split("|")  # List = první řádek TXT                         
                       PosledniRadekL=RadekL[-1].split("|") # List = posl. řádek TXT 
                       KsL[j] =len (RadekL) #počet kusů rolí=počet řádků
                       #print (KsL)
                       CisloJizd=int(PosledniRadekL[-2].replace(" ",""))                       
                       try:   SerieL[j] =(PosledniRadekL[-3].replace(" ","")) # Kontrola  počtu TXT a série --načteno z posledního řádku
                       except: print (   "Počet  TXT musí odpovídat počtu produkcí a sérií !")
                       CisloJizdOTV=int(str(CisloJizd).replace(","," "))
                       #print ("124...CisloJizd z Otevřené Krab",CisloJizdOTV) #                   
                   j=j+1; #print (j)
                   if CisloJizdOTV_min > CisloJizdOTV: CisloJizdOTV_min =CisloJizdOTV # CisloJizdOTV_min = nejm. číslo z otevř. krabic (pro ČD)
                   else: pass
                   #print ("129...Nejmensí z Otevřené Krab",CisloJizdOTV_min) #
                   if j==PROD:   CisloJizdOTV_PROD= CisloJizdOTV #číslo poslední produkce z otevř. krabic (pro DPB)
                   else: pass
                   #print ("   Posl. kus v otevřené krabici č.",nazev.replace("txt",""),":    ",CisloJizdOTV, CisloJizdOTV_PROD) 
               else: pass

         Vypis2=os.listdir(Cesta+"\\TXT") #NAČTENÍ POSL ČÍSLA  z HOTOVÝCH KRABIC.
         New=0;TxtLast=0
      
         #files = sorted(os.listdir(Cesta+"\\TXT"), key=lambda fn:os.path.getctime(os.path.join(Cesta+"\\TXT", fn[10:])))
         #print (files)
         
         TxtL=[]
         if  len (Vypis2)>0: # pokud jsou ve složce TXT hotové krabice
                    #print (Vypis2)
                    #print(sorted (Vypis2))             
                    for txt in Vypis2:
                        #NoTxt=int(txt.split("_")[0])
                        tup=(int(txt.split("_")[0]), txt) #; print (tup) 
                        TxtL.append (tup)
                        #print ("  číslo txt ", NoTxt)
                        #TxtTime=(os.path.getmtime(Cesta+"\\TXT\\"+txt)) # čas pořízení souboru
                        #if TxtTime>TxtLast: TxtLast=TxtTime; LastFile=txt # nalezení nejnovějšího souboru TXT
                        #if NoTxt>TxtLast: TxtLast=NoTxt; LastFile=txt# nalezení nejnovějšího souboru TXT
                        #print ("   Poslední hotová krabice: ", LastFile)
                    TxtL.sort()
                    #print (TxtL[-PROD:])
                    #LastFile=TxtL[5][1] # pátý soubor txt, celá adresa
                    for txt in (TxtL[-PROD:]):
                        LastFile=txt[1]
                        #print ("TXT: ",LastFile)
                        with open(Cesta+"\\TXT\\"+LastFile, "r", encoding="utf-8") as f:  # načtení  nejnovějšího hotového TXT
                                 RadekL=f.readlines()#načtení  obsahu rozprac. krabic  po řádcích do listu
                        #print ("97.....RadekL: ",RadekL)
                        PosledniRadekL=RadekL[-9].split("|") # 6. záznam odspodu v TXT    !!!!!!! V Případě změny TXT nutno změnit
                        #print ("99....PosledniRadekL", PosledniRadekL)
                        CisloJizdHOT=int(PosledniRadekL[-2].replace(" ",""))
                        #print ("   170...Poslední kus v hotových krabicích:   ",CisloJizdHOT)
                        NoTxt=CisloJizdHOT
                        if NoTxt>TxtLast: TxtLast=NoTxt;  BigestNo=CisloJizdHOT# nalezení nejnovějšího souboru TXT
                    #print  (BigestNo)       
         else:   CisloJizdHOT=0  
         #print(); print ("   Poslední kus v hotové krabici : ",BigestNo)
         #print ("ČD CisloJizdOTV_min",CisloJizdOTV_min)
 
         if JOB== "CD_POP"  or JOB== "CD_Vnitro" or JOB== "CD_Validator" :
             if CisloJizdHOT==0 and CisloJizdOTV_min == 0:
                 CisloJizd=CisloJizd1;# print (1) #  prázdné krabice =nový job
                 for i in range (PROD):  KsL.append(0); 
                 DictToShelve("VarSettings","PALETA/"+JOB, KsL) # nový JOB=Nová paleta 
             elif CisloJizdHOT==0 and CisloJizdOTV_min > 0: CisloJizdOTV_min ;#print (2)# nejsou hotové, ale jsou rozdělané krab
             elif CisloJizdHOT>0 and CisloJizdOTV_min  == 0: CisloJizd=CisloJizdHOT ;#print (3)# nejsou rozdělané, ale jsou jen hotové krab
             elif CisloJizdHOT<CisloJizdOTV_min: CisloJizd=CisloJizdHOT ;#print (4) # jsou hotové i rozdělané
             else: CisloJizd=CisloJizdOTV_min ;#print (5) # nejmenší číslo je v otevřené. krabici
             print ("   Poslední kus v otevřených  krabicích č.:",CisloJizd)
         else:pass          
         if JOB== "DPB_AVJ" :
             if CisloJizdHOT==0 and CisloJizdOTV_PROD == 0:
                 CisloJizd=CisloJizd1 # prázdné krabice =nový job
                 DictToShelve("VarSettings","PALETA/DPB_AVJ", [1,1,1,1,1,1]) # nový JOB=Nová paleta
             elif CisloJizdHOT==0 and CisloJizdOTV_PROD > 0: CisloJizd=CisloJizdOTV_PROD # nejsou hotové, ale jsou jen otevřené krab
             elif CisloJizdHOT>0 and CisloJizdOTV_PROD == 0: CisloJizd=BigestNo # nejsou otevřené, ale jsou jen hotové krab
             elif CisloJizdHOT<CisloJizdOTV_PROD: CisloJizd=BigestNo  # jsou hotové i otevřené krab.
             else: CisloJizd=CisloJizdOTV_PROD # nejmenší číslo je v otevřené. krabici
             #print ("182..",CisloJizd)
             #else: pass
             print ("   Poslední kus v otevřených  krabicích č.:",CisloJizdOTV_PROD)             
         else:pass         
         print(); print ("   První nový kus č.:                      ",CisloJizd-1); print()
  
  
Vyhoz=0; VyhozF=str("{:,}".format(Vyhoz))
RowTxt="";

class MyPanel(wx.Panel):
     def __init__(self, parent,id, JOB):
        wx.Panel.__init__(self, parent, id)
        global BarvaOkna1, Font1, BarvaPozadi1, BarvaTextu1,BarvaTextu2, PROD,CiselNaRoli, NT, SerieS     
        Font1=(wx.Font(8, wx.SWISS, wx.NORMAL, wx.BOLD, False, u'Verdana')); #self.Text1.SetForegroundColour(wx.Colour(0, 0, 0))
        BarvaOkna1= wx.Colour(255,255,194); BarvaPozadi1=wx.Colour(0, 159, 218);
        BarvaTextu1=wx.Colour(0, 38, 100);BarvaTextu2=wx.Colour(0, 129, 210)
        self.SetBackgroundColour(wx.Colour(BarvaPozadi1)) # světlá
        self.SetFont(wx.Font(18, wx.DEFAULT, wx.NORMAL, wx.BOLD,  False, u'Arial'));
        self.SetForegroundColour(BarvaTextu1)
        ############################ NACTENI HODNOT       
        SetXmlL=CteniXML(CWD+"\\FixSettings.xml",JOB)# načtení fixních dat
        Variab1L=ShelveToDict("VarSettings",JOB)# první načtení listu Variables
        #print ("252", Variab1L)
        CKrabNaPaleteL=ShelveToDict("VarSettings","PALETA/" + JOB) #načtení stavu palety
        #print ("254", CKrabNaPaleteL)
        Adresa=ShelveToDict("VarSettings","ADRESA") #načtení adresy      
        SerieL=Variab1L[1]; SerieS= (",".join(SerieL))
        #print ("...190...",SerieS) 
        KsVKr=int(Variab1L[3].replace(",",""));  PROD=int(Variab1L[6]);
        try:Skip=int(Variab1L[7]) # v případě "?"
        except: Skip=0
        #PrvniJizd=int(Variab1L[5].replace(",",""));
        KROK=SetXmlL[0]; CISLIC=SetXmlL[2];
        if JOB=="CD_Vnitro":  CiselNaRoli=SetXmlL[1];
        elif JOB=="CD_Validator":  CiselNaRoli=SetXmlL[1];
        elif JOB=="CD_POP": CiselNaRoli=Variab1L[2]; 
        elif  JOB=="DPB_AVJ":  CiselNaRoli=SetXmlL[1] ;
        else:pass
        PrvniKrab=int(Variab1L[4])
        ###Načtení počtu hotových krabic
        #CestaTxt=(Adresa+'\\REZANI\\'+JOB+"\\")
        RozprcaneKrabice(JOB)# načtení hodnot z rozpracovaných beden
        PrvniJizd = CisloJizd-1
        #print ("...147..",PrvniJizd )
        PocetTXT = len([f for f in os.listdir(Cesta+"\\TXT") if os.path.isfile(os.path.join(Cesta+"\\TXT", f))])# ! počet TXT ve složce=počet krabic
        #CreateFiles(JOB, Adresa, PrvniKrab) #vytvoření adesářů
        #RozprcaneKrabice(JOB)# načtení hodnot z rozpracovaných beden
        ###########################
        xvp1=93;   yvp=30
        self.Text1 = wx.StaticText  ( label="Job:            "+JOB, name='sken', parent=self, pos=wx.Point(xvp1, yvp), size=wx.Size(83, 20), style=0); self.Text1.SetFont(Font1)
        yvp=yvp+20;
        self.Text1 = wx.StaticText  ( label="V krabici:   "+str(KsVKr) +" ks", name='sken', parent=self, pos=wx.Point(xvp1, yvp), size=wx.Size(83, 20), style=0); self.Text1.SetFont(Font1)
        yvp=yvp+20;
        self.Text1 = wx.StaticText  ( label="Výhoz", name='sken', parent=self, pos=wx.Point(xvp1, yvp), size=wx.Size(45, 20), style=0); self.Text1.SetFont(Font1)       
        xvp2=xvp1+80 
        self.Text1 = wx.StaticText  ( label="Hot. krab.", name='sken', parent=self, pos=wx.Point(xvp2, yvp), size=wx.Size(40, 20), style=0); self.Text1.SetFont(Font1)
        xvp3=xvp2 +80; 
        self.Text1 = wx.StaticText  ( label="Počet rolí ", name='sken', parent=self, pos=wx.Point(xvp3, yvp), size=wx.Size(40, 20), style=0); self.Text1.SetFont(Font1)
        xvp4=330; 
        self.Text1 = wx.StaticText  ( label="Celkem", name='sken', parent=self, pos=wx.Point(xvp4, yvp), size=wx.Size(40, 20), style=0); self.Text1.SetFont(Font1)
               
        yvp=yvp+20; 
        self.Vyhoz= wx.TextCtrl(name=u'Sfield1', parent=self, pos=wx.Point(xvp1, yvp),size=wx.Size(70,20), style=wx.TE_LEFT,value=VyhozF ,validator=wx.DefaultValidator,id=-1);
        self.Vyhoz.SetBackgroundColour(BarvaPozadi1);self.Vyhoz.SetFont(Font1)
        
        PrvniKrabF=str("{:,}".format(int(PrvniKrab))).replace(","," ")
        self.Krabice= wx.TextCtrl(name=u'Sfield1', parent=self, pos=wx.Point(xvp2, yvp),size=wx.Size(70,20), style=wx.TE_LEFT,value=str(PocetTXT) ,validator=wx.DefaultValidator,id=-1);
        self.Krabice.SetBackgroundColour(BarvaPozadi1);self.Krabice.SetFont(Font1)
        
        PrvniJizd=str("{:,}".format(int(PrvniJizd))).replace(","," ").replace (" ","")
        
        #print ("288:",  PrvniJizd, CISLIC); 
        #PrvniJizdF=str.zfill(str(PrvniJizd), int(CISLIC)) # doplnení zleva nulama
        #PrvniJizdF=Deleni3(PrvniJizdF) # dělení po 3
        
        #print ("...174..",PrvniJizdF)
        self.PocetRoli= wx.TextCtrl(name=u'Sfield1', parent=self, pos=wx.Point(xvp3, yvp),size=wx.Size(70,20), style=wx.TE_LEFT,value=str(sum(KsL)) ,validator=wx.DefaultValidator,id=-1);
        self.PocetRoli.SetBackgroundColour(BarvaPozadi1);self.PocetRoli.SetFont(Font1)
        self.PocetRoli.SetToolTip("Počet rolí v otevřených krabicích")
        self.RoliCelkem= wx.TextCtrl(name=u'Sfield1', parent=self, pos=wx.Point(xvp4, yvp),size=wx.Size(70,20), style=wx.TE_LEFT,value=str(sum(KsL)+PocetTXT*KsVKr) ,validator=wx.DefaultValidator,id=-1);
        self.RoliCelkem.SetBackgroundColour(BarvaPozadi1);self.RoliCelkem.SetFont(Font1)            
        xvp=20;   yvp=100
        #self.Box2=wx.StaticBox (self, -1,size=wx.Size(440, 340), pos=wx.Point(xvp-5, yvp), label='')# rámeček

        global CisloJizdFL
        self.CB= []; self.PoleSerie = []; self.PoleCislo= []; self.PoleKusy = []; CisloJizdFL= [];self.PolePaleta = []        
        global StartCislaL, StartKusyL,  StartPaletyL, Nacteni
        StartCislaL= []; StartKusyL= [];StartPaletyL= [];        


        for k in range (0, PROD ):# počet produkcí pevný
            if  JOB=="CD_POP" :#všechny produkce mají stejná čísla
                PrvniJizdF=str.zfill(str(PrvniJizd), int(CISLIC)) # doplnení zleva nulama
                PrvniJizdF=Deleni3(PrvniJizdF) # dělení po 3
                CisloJizdFL.insert(k, PrvniJizdF) #všechny produkce mají stejná čísla
            elif JOB=="CD_Vnitro":
                PrvniJizdF=str (("{:0>"+ str(3)+"d}").format(int (PrvniJizd))) # 3 místné číslo
                CisloJizdFL.insert(k, PrvniJizdF) #PrvniJizd=PrvniRole
            elif JOB=="CD_Validator":
                PrvniJizdF=str (("{:0>"+ str(3)+"d}").format(int (PrvniJizd))) # 3 místné číslo
                CisloJizdFL.insert(k, PrvniJizdF) #PrvniJizd=PrvniRole
            elif JOB=="DPB_AVJ": #interval dělený počtem produkcí 
                PrvniJizd2=CisloJizd-Skip*((PROD-1)-k)-1
                if PrvniJizd2<0: PrvniJizd2="0"; print ("!  Moc velký skip   !")
                else: pass
                #print ("195...CisloJizd ",  CisloJizd)
                #print ("244...PrvniJizd2 ",  PrvniJizd2)
                PrvniJizdF2=str.zfill(str(PrvniJizd2), int(CISLIC)) # doplnení zleva nulama
                #PrvniJizdF2=PrvniJizdF2 [:(int(CISLIC)-3)]+" "+PrvniJizdF2[-3:]  #dělení po 3 !!!
                #print ("352 CisloJizdF2 ",CisloJizdFL)
                PrvniJizdF2=Deleni3(PrvniJizdF2) #dělení po 3 !!!
                CisloJizdFL.insert(k, PrvniJizdF2) # list dělený počtem produkcí
                #print ("351  CisloJizdF2 ",CisloJizdFL)
            else: pass
            #print ("k",k)
            try:
                #for k in range (0, PROD): #NAČTENÍ MINULÝCH DAT ze Settings.xml
                Zapis=((CteniXML4(Cesta+'\\Settings.xml')[SerieL[k]])[0][1])
                ZapisL=str(Zapis).split(",") #
                #print ("341 ",ZapisL)
                StartCislaL.append(ZapisL[0])
                StartKusyL.append(ZapisL[1].replace("ks",""))
                StartPaletyL.append(ZapisL[2])
                print ("  Načtení z ulož. dat: ", SerieL[k]); 
                #print ("345...", StartCislaL)
            except:
                print ("  Načtení série: ", SerieL[k]); 
                StartKusyL=KsL
                #print ("...352", StartKusyL)
                StartPaletyL=CKrabNaPaleteL
                #print ("360", StartPaletyL)
                StartCislaL=CisloJizdFL
   
            # Pole série, číslo a kusy
            yvp=yvp+45 
            self.CB.append (wx.CheckBox(self, label ="",pos = (xvp,yvp+8)))
            self.Bind(wx.EVT_CHECKBOX, self.funkceCheckBox, self.CB[k]); self.CB[k].SetValue(True)
            self.PoleSerie.append( wx.TextCtrl(name=str(k), parent=self, pos=wx.Point(xvp+25, yvp),size=wx.Size(46,40), style=wx.TE_CENTRE,value= str(SerieL[k]) ,validator=wx.DefaultValidator,id=-1))
            self.PoleSerie[k].SetBackgroundColour(BarvaOkna1);
            self.PoleCislo.append( wx.TextCtrl(name=str(k), parent=self, pos=wx.Point(xvp+75, yvp),size=wx.Size(180,40), style=wx.TE_CENTRE,value= str(StartCislaL[k]) ,validator=wx.DefaultValidator,id=-1))
            self.PoleCislo[k].SetBackgroundColour(BarvaOkna1)
            self.PoleKusy.append(wx.TextCtrl(name=str(k), parent=self, pos=wx.Point(xvp+260, yvp), size=wx.Size(85,40), style=wx.TE_CENTRE,value=str(StartKusyL[k]) +" ks",validator=wx.DefaultValidator,id=-1))
            self.PoleKusy[k].SetBackgroundColour(BarvaOkna1);self.PoleKusy[k].SetToolTip("Počet rolí v otevřené krabici")
            self.PolePaleta.append(wx.TextCtrl(name=str(k), parent=self, pos=wx.Point(xvp+355, yvp), size=wx.Size(85,40), style=wx.TE_CENTRE,value=str(StartPaletyL[k]),validator=wx.DefaultValidator,id=-1))
            self.PolePaleta[k].SetBackgroundColour(BarvaOkna1);self.PolePaleta[k].SetToolTip('Počet krabic položených na paletě \n  "0" = nový job (po opět. spuštění se stará paměť vymaže)\n  "-" číslování palet vypnuto')
      
        with open(CWD+"\\Zamestnanci\\Zamestnanci.txt", "r", encoding="utf-8") as f:  # načtení TXT zaměstnanců
            Vypis2L=f.readlines()#načtení  obsahu po řádcích do listu
        JmenaL= []      
        for jmeno in Vypis2L:  JmenaL.append(jmeno)
        #print (JmenaL)
        #########   Combobox Balení
        xvp =70; yvp=yvp+65
        self.ButtonNahled= wx.Button(self, -1, label="open", pos=wx.Point(xvp, yvp), size=wx.Size(55, 25)) #Button(  ,  ,Nápis,souřadnice,velikost)
        self.ButtonNahled.Bind(wx.EVT_BUTTON, lambda event: self.ButtonNahledTXT(Cesta))
        self.ButtonNahled.SetToolTip("Vstup do databází. \nTady je možno ručně opravit  špatný zápis")
        self.ButtonNahled.SetBackgroundColour(wx.Colour(BarvaPozadi1)) ; self.ButtonNahled.SetFont(wx.Font(10, wx.DEFAULT, wx.NORMAL, wx.BOLD,  False, u'Arial'));
 
        yvp=yvp+30 # Mimořádný tisk
        self.ButtonTisk= wx.Button(self, -1, label="print", pos=wx.Point(xvp, yvp), size=wx.Size(55, 25)) #Button(  ,  ,Nápis,souřadnice,velikost)
        self.ButtonTisk.Bind(wx.EVT_BUTTON, lambda event: self.TiskTXT(Cesta,JOB))
        self.ButtonTisk.SetToolTip("Tisk mimo pořadí \nCTRL - ozn. více souborů \nV příp tisku rozdělaných krabic je třeba vybrat baliče")
        self.ButtonTisk.SetBackgroundColour(wx.Colour(BarvaPozadi1)) ; self.ButtonTisk.SetFont(wx.Font(10, wx.DEFAULT, wx.NORMAL, wx.BOLD,  False, u'Arial'));
 
        xvp=145; yvp=yvp-30  # Balení
        self.ComboBalil=wx.ComboBox(self, -1, value="Vyber jmeno...", pos=wx.Point(xvp, yvp), size=wx.Size(177, 25), choices=JmenaL, style=0,  name="Balil")
        self.ComboBalil.SetBackgroundColour(wx.Colour("white")); self.ComboBalil.SetFont(wx.Font(10, wx.MODERN, wx.NORMAL, wx.NORMAL, 0,"Arial"))
        self.ComboBalil.Bind(wx.EVT_COMBOBOX, self.ComboBalil1)
        self.ComboBalil.SetFocus()
        
        xvp =340; # Seznam pro ČD
        self.ButtonSeznam= wx.Button(self, -1, label="Seznam", pos=wx.Point(xvp, yvp), size=wx.Size(75, 25)) #Button(  ,  ,Nápis,souřadnice,velikost)
        self.ButtonSeznam.Bind(wx.EVT_BUTTON, lambda event: self.Seznam(Cesta,JOB))
        self.ButtonSeznam.SetToolTip("Vytvoření klientských sestav")
        self.ButtonSeznam.SetBackgroundColour(wx.Colour(BarvaPozadi1)) ; self.ButtonSeznam.SetFont(wx.Font(10, wx.DEFAULT, wx.NORMAL, wx.BOLD,  False, u'Arial'));
 
        xvp =145; yvp=yvp+30   # Tisk sestav
        self.Sestava=wx.CheckListBox(self, -1, choices=[" Nahled", "  Tisk", " HTML"], pos=wx.Point(xvp, yvp), size=wx.Size(177, 25), style=0,  name="Sestava")
        #self.Sestava.SetFont(wx.Font(11, wx.MODERN, wx.NORMAL, wx.NORMAL, 0,"Arial")); self.Sestava.Check(NT1, check=True)#self.Sestava.SetBackgroundColour(wx.Colour(BarvaPozadi1)) nefunguje
        self.Sestava.SetFont(wx.Font(11, wx.MODERN, wx.NORMAL, wx.NORMAL, 0,"Arial")); self.Sestava.Check(NT1, check=True); #self.Sestava.Check(NT2, check=True);#self.Sestava.SetBackgroundColour(wx.Colour(BarvaPozadi1)) nefunguje
        try: self.Sestava.Check(NT2, check=True)# v případě jen jednoho zaškrtnutí
        except: pass

        self.Sestava.Bind(wx.EVT_CHECKLISTBOX, self.CLBSestava); NT=(NT1,NT2) #nastavit  pozice stejnou jako True
        self.Sestava.SetToolTip("Výstup: \n- Náhled před tiskem\n- Jenom tisk ")        
        # BUTTON
        xvp=185; yvp=yvp+60
        self.ButtonOK1 = wx.Button(self, -1, label="OK", pos=wx.Point(xvp, yvp+15), size=wx.Size(85, 55)) #Button(  ,  ,Nápis,souřadnice,velikost)
        self.ButtonOK1.Bind(wx.EVT_BUTTON, lambda event: self.ButtonOK(JOB))
        self.ButtonZ1= wx.Button(self, -1, label="<", pos=wx.Point(xvp-40, yvp+15), size=wx.Size(35, 55)) #Button(  ,  ,Nápis,souřadnice,velikost)
        self.ButtonZ1.SetToolTip("Zpět o 1 roli")
        self.ButtonZ1.Bind(wx.EVT_BUTTON, lambda event: self.ButtonZP1(JOB))
        self.ButtonZ2= wx.Button(self, -1, label="<<", pos=wx.Point(xvp-80, yvp+15), size=wx.Size(35, 55)) #Button(  ,  ,Nápis,souřadnice,velikost)
        self.ButtonZ2.SetToolTip("Zpět o 10 rolí")        
        self.ButtonZ2.Bind(wx.EVT_BUTTON, lambda event: self.ButtonZP2(JOB))
        self.ButtonT1= wx.Button(self, -1, label=">", pos=wx.Point(xvp+90, yvp+15), size=wx.Size(35, 55)) #Button(  ,  ,Nápis,souřadnice,velikost)
        self.ButtonT1.SetToolTip("Dopředu o 1 roli")   
        self.ButtonT1.Bind(wx.EVT_BUTTON, lambda event: self.ButtonTA1(JOB))
        self.ButtonT2= wx.Button(self, -1, label=">>", pos=wx.Point(xvp+130, yvp+15), size=wx.Size(35, 55)) #Button(  ,  ,Nápis,souřadnice,velikost)
        self.ButtonT2.SetToolTip("Dopředu o 10 rolí")           
        self.ButtonT2.Bind(wx.EVT_BUTTON, lambda event: self.ButtonTA2(JOB))
        self.CBTurbo=wx.CheckBox(self, -1, label="Turbo", pos=wx.Point(xvp+205, yvp+25)) #Button(  ,  ,Nápis,souřadnice,velikost)
        self.CBTurbo.SetToolTip("Po celých protokolech")           
        self.CBTurbo.Bind(wx.EVT_CHECKBOX, self.cbTurbo1)        
        self.CBTurbo.SetFont(wx.Font(10, wx.DEFAULT, wx.NORMAL, wx.BOLD,  False, u'Arial'));#self.CBTurbo.SetValue(True)
        #self.ButtonTurbo.SetBackgroundColour("SEA GREEN"); self.ButtonTurbo.SetFont(wx.Font(12, wx.DEFAULT, wx.NORMAL, wx.BOLD,  False, u'Arial'));                
        ####### načtení TXT zaměstnanců

     def CLBSestava(self, event): # CheckListBox
           global NT
           NT=(self.Sestava.GetCheckedItems())
           print (NT)
           #print ("   Tisk výstup: ", self.Sestava.GetCheckedStrings())
 
     def TiskTXT(self,Cesta,JOB): # Tisk z adresáře
         print ('  Vyber soubory k tisku protokolu \n"SHIFT" = více souborů')
         CestaTxtL=(Okno(Cesta+"\TXT")) #  LIst vybraných adres TXT
         
         BALIL=self.ComboBalil.GetValue(); # V případě rozdělaných krabic není balič
         if BALIL=="Vyber jmeno...": 
             print ("   !Vyber jmeno baliče!")
             ctypes.windll.user32.MessageBoxW(0, "Vyber jméno baliče", "Warning message", 1)
         else:  Protokoly.Ulozeni_PDF(CestaTxtL, Cesta,JOB, BALIL, NT,"PRINT") # 
         #Protokoly.Ulozeni_PDF(CestaTxtL, Cesta,JOB, NT) # return CISLO
         #print (Protokoly.Ulozeni_PDF_A5A6(CestaTxtL, Cesta)) #LIst vybraných adres PDF
         #print ("324....",CestaTxtL, Cesta, JOB, NT)

     def Seznam(self,Cesta,JOB): # Seznam pro ČD
       if JOB=="CD_Vnitro" or JOB=="CD_Validator":
         print ('  Vyber soubory TXT ze kterých má vzniknout seznam  \n"SHIFT" = více souborů')
         CestaTxtL=(Okno(Cesta+"\TXT")) #  LIst vybraných adres TXT
         ser1=""; od1="0"; por2=""; ser2=""; od2="";i=1; j=0;k=0;radek="";poleS=""
         Adresa=ShelveToDict("VarSettings","ADRESA") #načtení adresy
         try:
             os.remove(Adresa+'\\REZANI\\'+JOB+"\\CSV\\"+"Sestava_CD ZS Praha"+'.csv')
             os.remove(Adresa+'\\REZANI\\'+JOB+"\\CSV\\"+"Sestava_CD Zlin"+'.csv')
             os.remove(Adresa+'\\REZANI\\'+JOB+"\\CSV\\"+"Sestava_Kontrola"+'.csv')             
         except: pass
         CSV1= open(Adresa+'\\REZANI\\'+JOB+"\\CSV\\"+"Sestava_CD ZS Praha"+'.csv', 'a', newline='') # vznik csv
         CSV2= open(Adresa+'\\REZANI\\'+JOB+"\\CSV\\"+"Sestava_CD Zlin"+'.csv', 'a', newline='') # vznik csv
         CSV3= open(Adresa+'\\REZANI\\'+JOB+"\\CSV\\"+"Sestava_Kontrola"+'.csv', 'a', newline='') # vznik csv         
         try:
             zaznam1 = csv.writer(CSV1, quotechar ='"', quoting=csv.QUOTE_MINIMAL) # ČD ZS Praha
             zaznam2 = csv.writer(CSV2, quotechar ='"', quoting=csv.QUOTE_MINIMAL) # ČD Zlin
             zaznam3 = csv.writer(CSV3, quotechar ='"', quoting=csv.QUOTE_MINIMAL) # Kontrola
         except: pass
         titulek1= "Poř.č." +";"+"Série"+";"+"OD"+";"+"DO"+";"+"KS"+";"+"Č. krab."  # Praha
         zaznam1.writerow([titulek1])
         titulek2= "Serie" +";"+"Pořadí"+";"+"poř./OD"+";"+"Č.krab.celk."+";"+"Expedice"+";"+"Poznámka"  # Zlín
         zaznam2.writerow([titulek2])
         titulek3= "Krab.č"+";"+"nazev Txt"+";"+"Č.kr.na pal."+";"+"Série"+";"+"OD"+";"+"KS" +";"+"Přer. řady"+";" # Kontrola- upravit
         zaznam3.writerow([titulek3])
         print ()
         for CestaTxt in CestaTxtL: 
            with open(CestaTxt, "r", encoding="utf8") as f:  # načtení ks z hotových TXT
                VypisL=f.readlines() #načtení  obsahu TXT po řádcích do listu      
                if len (VypisL)>1: #eliminace prázdných (nehotových)
                    if JOB=="CD_Vnitro" or JOB=="CD_Validator" :
                      for sekvence in VypisL:              
                          if sekvence.count( "BALIL" ) ==1: BALIL=sekvence.replace("BALIL: ", '').replace("\n", '')
                          else: pass #BALIL=BALIL.replace("\n", '') #  načteno z paramerů  funkce - tisk rozdělané krabice 
                          if sekvence.count( "CISLO_KRABICE" ) ==1: CISLO=sekvence.replace("CISLO_KRABICE:", '').replace("\n", '').replace(" ","")                   
                          else: pass #CISLO="0"
                          if sekvence.count( "C_KRAB_NA_PALETE:" ) ==1:  C_KRAB_NA_PALETE =sekvence.replace("C_KRAB_NA_PALETE: ", '').replace("\n", '').replace(" ","")            
                          else: pass
                    VypisL=[n for n in VypisL if n.count ("|")== 3] 
                    VypisL.reverse()
                    vypisA=VypisL[0]; vypisAL=vypisA.split ("|");  #por0=vypisL2[0]; ser0=vypisL2[1]; od0=vypisL2[2][:3];#načtení 1. řádku
                    vypisZ=VypisL[-1]; vypisZL=vypisZ.split ("|");
                    polA=vypisAL[0] ;serA=vypisAL[1] ;odA=vypisAL[2].split(" ")[0]
                    polZ=vypisZL[0] ;serZ=vypisZL[1] ;odZ=vypisZL[2].split(" ")[0]
                    radekA=polA +"./"+odA
                    radekA1=odA
                    radekZ=polZ +"./"+odZ
                    radekZ1=odZ
                    od0=odA
                    Krabice=(str.zfill (CISLO, 4))+"."
                    CkrabNaPalF=(str.zfill (C_KRAB_NA_PALETE, 3))+"."
                    CisloTxt=CestaTxt.split ('\\')[-1] 
                    #print ("493...",CisloTxt)
                    kr=1;MinulaKrabice=1; MinuleCislo=0
                    for vypis in VypisL: # výpis zaznamu z krabice
                            #print ("...489", vypis)
                            vypisL2=vypis.split ("|") # list ze záznamů z krabice
                            #print ("491...", vypisL2[0], vypisL2[1],vypisL2[2]," ",Krabice,"  ",CkrabNaPalF )#[0];
                            ser=vypisL2[1]; #od=vypisL2[2].split(" ")[0]; # ??  
                            vypisS=VypisL[k]; vypisSL=vypisS.split ("|"); polS=vypisSL[0] ;serS=vypisSL[1] ;odS=vypisSL[2].split(" ")[0] #rádek aktuální

                            if Krabice == MinulaKrabice:
                                kr=kr+1                                     
                                #radekKontrolni=Krabice+";"+CkrabNaPalF+";"+serS+";"+odS +";"+str(kr) # Kontrola   
                            else:
                                kr=1
                            radekKontrolni=Krabice+";"+CkrabNaPalF+";"+serS+";"+odS+";"+str(kr) # Kontrol 
                            MinulaKrabice=Krabice
                            
                            #print ("...509...", odS, MinuleCislo)
                            if   int(odS)==MinuleCislo+1  or kr==1:
                                    radekKontrolni=Krabice+";"+CisloTxt+";"+CkrabNaPalF+";"+serS+";"+odS +";"+str(kr) +";"+""# Kontrola                              
                            else:
                                    radekKontrolni=Krabice+";"+CisloTxt+";"+CkrabNaPalF+";"+serS+";"+odS+";"+str(kr)+";"+"PŘ" # Kontrola                         
                            MinuleCislo=int(odS)
        
                            #print ("494...", (vypisSL) )                            
                            vypisS_1=VypisL[k-1]; vypisS_1L=vypisS_1.split ("|"); polS_1=vypisS_1L[0] ;serS_1=vypisS_1L[1] ;odS_1=vypisS_1L[2].split(" ")[0]#rádek aktuální-1
                            #print (j); #print ("  ", k)
                            #try: kontrola = int(od);kontrola = int(por);  # Kontrola
                            #except:  print ("   ! Chyba v  TXT č: " +Krabice, ",  pol: ",por  )   
                            if int(odS) !=int(od0)+1 : # Jen při přerušení řady
                                if j !=0:# první přerušení se neeviduje                                     
                                    poleS1=odS_1 #  o 1 cyklus zpět jelikož přerušení se identifikuje až v aktuálním cyklu
                                    poleS=odS  # aktuální cyklus                                                                  
                                    if radekA1!=poleS1: #v případě kotoučů OD-DO                                     
                                        celkem=str( int(poleS1)-int(radekA1)+1) ; celkem=(str.zfill (celkem, 2))                                                                              
                                        poleS_OdDo=Krabice +";"+serA+";"+radekA1+";"+poleS1+";"+celkem+";"+ CkrabNaPalF                                                                              
                                        print (Krabice +" "+serA, " OD: ",radekA1, " DO ", poleS1 , "  ",celkem)
                                        zaznam1.writerow([poleS_OdDo]) # Praha
                                    else:  #v případě jen  jediného kotouče (OD)
                                        celkem= "01"
                                        poleS_1kus=Krabice+";"+serA+";"+poleS1+";"+";"+celkem+";"+CkrabNaPalF                                       
                                        zaznam1.writerow([poleS_1kus]) # Praha
                                        print (Krabice +" "+serA, " OD: ",poleS1,  18*" ", celkem)                       
                                    poleS1=poleS;   radekA1=poleS1; 
                                    #print ("   ",j, ". split ")                            
                                    #radek0=por+"./"+od 
                                else: pass                                                                      
                                j=j+1
                            else: pass                       
                            if k==0: radek2=serS+";"+CkrabNaPalF+";" +polS +"./"+odS+";"+Krabice #  Zlín
                            else: radek2=serS+";"+CkrabNaPalF+";" +polS +"./"+odS #  Zlín                           
                            zaznam2.writerow([radek2]) # Sestava Zlín                       
                            zaznam3.writerow([radekKontrolni]) # Sestava kontrolni          
                            k=k+1                        
                            #por_1=por;
                            #ser_1=ser; #od_1=od;
                            ser0=serS;  od0=odS
                    #print (20*" ", por2, ser2, od2), #poslední záznam
                    #radekKrab=Krabice +";"+serA+"..."+odS_1+";"+radekA1+";"+radekZ1+";"+celkem+";"+CkrabNaPalF # Praha
                    if radekA1!=radekZ1: #v případě kotoučů OD-DO # Praha
                         celkem=str( int(radekZ1)-int(radekA1)+1); celkem=(str.zfill (celkem, 2))
                         print (Krabice +" "+serA," OD: ",radekA1, " DO ", radekZ1 , "  ",celkem);
                         radekKrab=Krabice +";"+serA+";"+radekA1+";"+radekZ1+";"+celkem+";"+CkrabNaPalF # Praha
                    else:
                        celkem= "01"
                        print (Krabice +" "+serA," OD: ",radekA1 , 18*" ", celkem )
                        radekKrab=Krabice +";"+serA+";"+radekA1+";"+";"+celkem+";"+CkrabNaPalF
                    zaznam1.writerow([radekKrab]) # Sestava Praha
                    i=i+1; j =0 ;k=0
         print ("Seznamy jsou ve složce: ", Adresa+'\\REZANI\\'+JOB+"\\CSV")
         webbrowser.open(Adresa+'\\REZANI\\'+JOB+"\\CSV")
         
         
       else: print ("pro tento job není funkce Seznam dostupná")
         #doL=(por, ser, od)
         #print ("   DO: ",doL)
         #zaznam.writerow([radek])
         #zaznam.writerow([doL[0]])

     def funkceCheckBox(self, event):
         for k in range (0, PROD):
            if self.CB[k].GetValue()==False: #  nezaškrtnutý             
                self.PoleCislo[k].SetSize (181, 40); self.PoleKusy[k].SetSize (85, 41);self.PoleSerie[k].SetSize (46, 41);self.PolePaleta[k].SetSize (85, 41);              
                self.PoleCislo[k].SetBackgroundColour(BarvaPozadi1);  
                self.PoleCislo[k].SetForegroundColour(BarvaTextu2);  
                self.PoleSerie[k].SetBackgroundColour(BarvaPozadi1); 
                self.PoleSerie[k].SetForegroundColour(BarvaTextu2);
                self.PoleKusy[k].SetBackgroundColour(BarvaPozadi1)
                self.PoleKusy[k].SetForegroundColour(BarvaTextu2)
                self.PolePaleta[k].SetBackgroundColour(BarvaPozadi1)
                self.PolePaleta[k].SetForegroundColour(BarvaTextu2)
            else: 
                self.PoleCislo[k].SetSize (180, 40); self.PoleKusy[k].SetSize (85, 40);self.PoleSerie[k].SetSize (46, 40);self.PolePaleta[k].SetSize (85, 40);
                self.PoleCislo[k].SetBackgroundColour(BarvaOkna1); 
                self.PoleCislo[k].SetForegroundColour(BarvaTextu1);  
                self.PoleSerie[k].SetBackgroundColour(BarvaOkna1); 
                self.PoleSerie[k].SetForegroundColour(BarvaTextu1);
                self.PoleKusy[k].SetBackgroundColour(BarvaOkna1)
                self.PoleKusy[k].SetForegroundColour(BarvaTextu1)      
                self.PolePaleta[k].SetBackgroundColour(BarvaOkna1)
                self.PolePaleta[k].SetForegroundColour(BarvaTextu1)
     def cbTurbo1(self,event):
              if self.CBTurbo.GetValue()==True: print ("  Po celých krabicích")
              else: pass
              #Turbo= (event.GetEventObject().GetLabel()) 
              #print (Turbo) 
     
     def ButtonOK(self, JOB):
        CestaTxtL=[];       RowpolD={} #import HTMLProtokol
        global Vyhoz,KsL,RowTxt#CKrabNaPaleteL
        SetXmlL=CteniXML(CWD+"\\FixSettings.xml",JOB)# načtení fixních dat
        VariablesL=ShelveToDict("VarSettings",JOB)# načtení variabilních dat
        Variab1L=ShelveToDict("VarSettings",JOB)# první načtení listu Variables
        Adresa=ShelveToDict("VarSettings","ADRESA") #načtení adresy
        #Palety=ShelveToDict("VarSettings","PALETA/" + JOB) #načtení stavu palety
        KsVKr=int(Variab1L[3].replace(",","")); PROD=int(Variab1L[6].replace(",",""));
        PrvniJizd=int(Variab1L[5].replace(",","")); PrvniJizdF=str("{:,}".format(PrvniJizd)).replace(","," ");
        PrvniKrab=int(VariablesL[4])
        #CISLIC=SetXML[JOB][3] #počet číslic
        Balil=self.ComboBalil.GetValue();
        CSV= open(Adresa+'\\REZANI\\'+JOB+"\\CSV\\"+str(PrvniJizd)+'.csv', 'a', newline='') # vznik csv
        try: zaznam = csv.writer(CSV)
        except: pass
        #zaznam.writerow(["Krabice;Paleta;Serie OD-DO;čas uložení"])
        if Balil=="Vyber jmeno...":
            print ("!   Vyber jméno baliče  !")
            Balil = "..............................."
            ctypes.windll.user32.MessageBoxW(0, "Vyber jméno baliče", "Warning message", 1)
        else:     
            if JOB=="CD_Vnitro":  CiselNaRoli=SetXmlL[1] ;CKrabNaPaleteL=[0,0,0,0,0,0]
            if JOB=="CD_Validator":  CiselNaRoli=SetXmlL[1] ;CKrabNaPaleteL=[0,0,0,0,0,0]
            elif JOB=="CD_POP": CiselNaRoli=VariablesL[2];CKrabNaPaleteL=[0,0,0,0,0,0]
            elif JOB=="DPB_AVJ": CiselNaRoli=1; CKrabNaPaleteL=[0,0,0,0,0,0]
            
            ###přidat konec krabice
            if self.CBTurbo.GetValue()==True: Cyklus=KsVKr;
            else: Cyklus=1; #print (Cyklus)
            #self.CBTurbo.SetValue(False) # odškrtnutí při "OK"
            CisloRoleFL=[]; KoncCisloRoleL=[];          RowCsv=""; VypisL2=[];
            for i in range (0,Cyklus): # počet ks v krab         
                #CisloRoleF=self.PoleCislo[i].GetValue();CisloRole=int(CisloRoleF.replace(" ","")) # načteno z  polí
                #print ("313...:", self.PoleCislo[i].GetValue())  
                #KoncCisloRole=("{:,}".format(CisloRole-int(CiselNaRoli)+1)).replace(","," ");
                Vyhoz=Vyhoz +1;  VyhozF=str("{:,}".format(Vyhoz)) # dělení čísel po třech
                print ("Vyhoz:", Vyhoz) # Vyhoz               
                self.Vyhoz.SetValue(VyhozF) # zápis do pole Výhoz
                RowCsv=str(Vyhoz) +";" 
                for k in range (0, PROD):  # Range je 1 až X-1 !
                   CisloRoleF=self.PoleCislo[k].GetValue();CisloRole=int(CisloRoleF.replace(" ","")) # načteno z  polí
                   #KoncCisloRole=str((CisloRole-int(CiselNaRoli)+1))
                   SerieL[k]=self.PoleSerie[k].GetValue() # načtení skutečných serií                   
                   #if JOB=="CD_Vnitro":  KoncCisloRole =str(CisloRole)+" 0001"
                   #else: KoncCisloRole =int(CisloRole)-int(CiselNaRoli)+1
                   #print (self.PolePaleta[k].GetValue())
                   #CKrabNaPaleteL[k]=self.PolePaleta[k].GetValue()
                   #if int(self.PolePaleta[k].GetValue())==1: CKrabNaPaleteL[k]=0
                   #else: pass 
                                                              
                   if self.CB[k].GetValue()==True:# Checkbox u serie  zaškrtnutý
                      self.PoleKusy[k].SetForegroundColour("black");     
                      with open(Cesta+str(k+1)+".txt", "r", encoding="utf-8") as f:  # načtení KS z rozdělaných TXT
                                     VypisL=f.readlines()#načtení  obsahu TXT po řádcích do listu               
                      RadekL= []
                      for radek in VypisL:
                           if radek.count ("|")>=3: # vytřídění bordelu 
                               RadekL.append(radek)
                      #PrvniRadekL=RadekL[0].split("|")  # List z prvního řádku TXT
                      #print ("402",RadekL)                           
                      KsL[k] =len (RadekL) # počet kusů v TXT=počet řádků  =Počty kusu v krab  KsL =např [12,1,24,4,4,4]
                      #print ("404",KsL)
                      #Ks=("{:0>2d}".format(KsL[k]+1))# formátování pouze pro zápis do TXT
                      Ks=("{:0>2d}".format(KsVKr-KsL[k]))# formátování pouze pro zápis do TXT

                      if JOB=="CD_Vnitro":
                          KoncCisloRole =str(CisloRole)+" 0001"
                          CisloRoleF=str(CisloRole)+" 1000"
                      elif JOB=="CD_Validator":
                          KoncCisloRole =str(CisloRole)+" 0001"
                          CisloRoleF=str(CisloRole)+" 500"                         
                      else:
                          KoncCisloRole =int(CisloRole)-int(CiselNaRoli)+1                      
                          KoncCisloRole=str.zfill(str(KoncCisloRole), int(CISLIC)) # doplnení zleva nulama
                          KoncCisloRole=Deleni3(KoncCisloRole)
                      RowTxt=Ks+"|"+SerieL[k] +"|"+str(KoncCisloRole) +"|"+str (CisloRoleF)+"\n"   # zápis záznamu do TXT      
                      if int(CisloRole)<1:
                          print ("!   Záporná čísla. Blbě zadáno  !")
                          return                     
                      else: pass
                      if KsL[k]<(KsVKr -1):  # ROZDĚLANÁ KRABICE
                         KsL[k]=KsL[k]+1    # přidání do krabic
                         with open(Cesta+str(k+1)+'.txt', 'a',encoding="utf-8") as f:
                             f.write(RowTxt) # další záznam                            
                             print ("  "+SerieL[k] +"  "+str(KoncCisloRole)+" - "+str (CisloRoleF));
                      else: # PLNÁ KRABICE = přejmenování  txt , a č. Krabice+1
                          named_tuple = time.localtime() # čas
                          Time=time_string = time.strftime("%m/%d/%Y, %H:%M:%S", named_tuple) #formát času
                          PocetTXT = len([f for f in os.listdir(Cesta+"\\TXT") if os.path.isfile(os.path.join(Cesta+"\\TXT", f))])# ! počet TXT ve složce=počet krabic
                          cisl=str(PocetTXT+1).replace(" ","")                          
                          try:CKrabNaPaleteL[k]=int(self.PolePaleta[k].GetValue())+1
                          except:
                              print ("  vypnute cisl. krab. na paletach")
                              CKrabNaPaleteL[k]="-"
                          #print (".....723", CKrabNaPaleteL[k])             
                          with open(Cesta+str(k+1)+'.txt', 'a',encoding="utf-8") as f: 
                                f.write(RowTxt)# poslední záznam.                       
                                f.write("\nJOB: "+JOB+"\nCISLO_KRABICE: "+cisl+"\nPRODUKCE: "+str(k+1)+"\nC_KRAB_NA_PALETE: "+str(CKrabNaPaleteL[k])+"\nMNOZSTVI: "+str(KsVKr)+" ks"+ "\nBALIL: "+ Balil+"CAS: "+ Time)# doplnění  záznamu o čas, balil...                                                               
                         #print (".....Protokol.Nahled", (CestaTxt, KsL,k, PocetTXT,JOB, PrvniKrab,Balil,PROD,[1,1]))
                          #Protokol.Nahled(CestaTxt, KsL,k, SerieL, PocetTXT,JOB, PrvniKrab,Balil,PROD,NT)
                          KsL[k]=0# nová krabice (Počet ks=1)                                       
                          self.Krabice.SetValue(str(PocetTXT+1))# zvýšení čísla krabice
                          shutil.move(Cesta+str(k+1) +'.txt', Cesta+"\\TXT\\"+str(PocetTXT+1) +"_"+SerieL[k]+'.txt', copy_function = shutil.copytree)# přehození do adresáře TXT
                          
                          with open(Cesta+"\\TXT\\"+str(PocetTXT+1) +"_"+SerieL[k]+'.txt', "r", encoding="utf-8") as f:  # načtení TXT
                                 VypisL2=f.readlines()#načtení  obsahu otv. krabic  po řádcích do listu

                          TXT=open(Cesta+str(k+1)+'.txt', 'wt')  # založení nového
                          CestaTxt=Cesta+"\\TXT\\"+cisl+"_"+SerieL[k]+'.txt' #
                          #HTMLProtokol.Nahled(CestaTxt, KsL,k, SerieL, PocetTXT,JOB, PrvniKrab,Balil,PROD,NT)
                          # CestTxt = úplná cesta ke souboru, Cesta= Cesta ke složce REZANI
                          #if CKrabNaPaleteL[k] != "-": CKrabNaPaleteL[k]=int (CKrabNaPaleteL[k]) # číslování palet začne po změně 0 na 1
                          #else:pass
                          #print ("....736", CKrabNaPaleteL[k] )
                          if CKrabNaPaleteL[k] == "-": self.PolePaleta[k].SetValue("-")
                          else: self.PolePaleta[k].SetValue(str(CKrabNaPaleteL[k]))                       
                          self.PoleKusy[k].SetForegroundColour("blue");        
                          CestaTxtL.append(CestaTxt)#List TXT k náhledu a tisku
                      
                      if JOB=="CD_Vnitro" or JOB=="CD_Validator": #odečítají se celé role, ne jízdenky
                          CisloRole2=int(CisloRole)-1; 
                          CisloRoleF2=str.zfill(str(CisloRole2), int(3)) # počet pozic
                      else:
                          CisloRole2=int(CisloRole)-int(CiselNaRoli);  #CisloRoleF2=str("{:,}".format(CisloRole2)).replace(","," ");#??                                    
                          CisloRoleF2=str.zfill(str(CisloRole2), int(CISLIC)) # doplnení zleva nulama
                          CisloRoleF2=Deleni3(CisloRoleF2)
                      self.PoleCislo[k].SetValue(CisloRoleF2); 
                      self.PoleKusy[k].SetValue(str(KsL[k])+" ks");
                   else: #  Odškrtnutý Checkbox
                       print (" ",SerieL[k], " vyřazeno")
                       if JOB=="CD_Vnitro" or JOB=="CD_Validator" :
                          CisloRole2=int(CisloRole)-1; 
                          CisloRoleF2=str.zfill(str(CisloRole2), int(3)) # počet pozic                             
                       else:
                           CisloRole2=int(CisloRole)-int(CiselNaRoli);#? vyhodit test                       
                           CisloRoleF2=str.zfill(str(CisloRole2), int(CISLIC)) # doplnení zleva nulama
                           CisloRoleF2=Deleni3(CisloRoleF2)                       
                       self.PoleCislo[k].SetValue(CisloRoleF2);#? vyhodit test
                       
                   ###zápis do CSV###                                   
                   if len (VypisL2)>1: # uzavřená jedna krabice v dané produkci
                        RowpolS="" 
                        for rowpol in VypisL2: # výpis z uloženého Txt
                            if rowpol.count("|")==3:
                                  rowpol=rowpol.replace("\n","")
                                  rowpolL=rowpol.split("|")
                                  #RowpolD[rowpol]=k
                                  RowpolS=RowpolS+";"+rowpolL[1] +" "+rowpolL[2] +"_"+rowpolL[3]
                  
                        RowpolS=str(PocetTXT+1)+";"+str(CKrabNaPaleteL[k]) +RowpolS+";"+Time.replace(","," ")+";"+Balil.replace("\n","")
                        RowpolS=RowpolS.encode("UTF 8")
                        zaznam.writerow([RowpolS])#záznam do CSV
                        VypisL2=[]
                        ###konec zápisu do CSV###                                               
                        # zápis CSV do TXT jen z důvodu problematického kódování češtiny
                        #TXT1= open(Adresa+'\\REZANI\\'+JOB+"\\CSV\\"+str(PrvniJizd)+'.txt', 'wt') # TXT namisto CSV               
   
                named_tuple = time.localtime() # čas        
                Time=time_string = time.strftime("%m/%d/%Y, %H:%M:%S", named_tuple).replace(","," ") #formát času    
                RowCsv=RowCsv+str(" "+Time)+";"
                self.PocetRoli.SetValue(str(sum(KsL)))# Aktuální počet rolí
                RolivKrab=int(self.Krabice.GetValue())*KsVKr;   self.RoliCelkem.SetValue(str(sum(KsL)+RolivKrab))                     
                #zaznam = csv.writer(CSV) 
                #Row=str(Vyhoz-1)+";"+SerieS+";"+str(CisloRole)
                #print("455", CestaTxtL, Cesta, JOB,NT)
                BALIL=""# pro neuplnou krabici.  V příp. úplné se načte z TXT
            if len (CestaTxtL)>=1: 
                DictToShelve("VarSettings","PALETA/"+JOB, CKrabNaPaleteL)
                Protokoly.Ulozeni_PDF(CestaTxtL,Cesta, JOB,BALIL,NT,"OK") # Create PDF + Uložení               
                #print ("498...","Ulozeni_PDF(",CestaTxtL,",'"+Cesta+"','"+JOB+"','"+BALIL+"',",NT,",",'OK',")")
                
            SD={}; i=0; NestedL=[]  
            for k in range (0, PROD): #zápis posl. stavu do XML
                    NestedL.append([])
                    #for j in  [SerieL[k], "self.PoleCislo[k].GetValue()","Text"]:
                    #for j in ["prod_"+str(k+1), SerieL[k], (self.PoleCislo[k].GetValue(), self.PoleKusy[k].GetValue() )]:
                    for j in [SerieL[k], self.PoleCislo[k].GetValue()+","+self.PoleKusy[k].GetValue()+","+ self.PolePaleta[k].GetValue(), " "+str(k+1)+". prod."]:
                         NestedL[k].append(j)
            SD=([{"cisla_od": NestedL},{"balil":[("jmeno",self.ComboBalil.GetValue(),"vyst_kontrola")]}])      
            #print (SD)
            CreateXML4(SD, Cesta+'\\Settings.xml')            
       
     def ButtonZP1(self, JOB): #zpětný posun o 1 krok
         #print ("798", CKrabNaPaleteL)
         if JOB=="CD_POP" or JOB== "CD_Vnitro" or JOB== "CD_Validator": Skip=int(CiselNaRoli)
         elif  JOB== "DPB_AVJ": Skip=1
         for k in range (0, PROD):
             CisloRoleF=self.PoleCislo[k].GetValue()# načteno z první produkce
             CisloRole=CisloRoleF.replace(" ","")
             CisloRole2=int(CisloRole)+int(Skip);
             CisloRoleF2=str.zfill(str(CisloRole2), int(CISLIC)) # doplnení zleva nulama
             CisloRoleF2=Deleni3(CisloRoleF2)
             #CisloRoleF2=str("{:,}".format(CisloRole2)).replace(","," ");
             self.PoleCislo[k].SetValue(CisloRoleF2);
     def ButtonZP2(self, JOB):#zpětný posun o 10 kroků
         if JOB=="CD_POP"  or JOB== "CD_Vnitro" or JOB== "CD_Validator" : Skip=int(CiselNaRoli)
         elif  JOB== "DPB_AVJ": Skip=1         
         for k in range (0, PROD):
             CisloRoleF=self.PoleCislo[k].GetValue()# 
             CisloRole=CisloRoleF.replace(" ","")
             CisloRole2=int(CisloRole)+10*int(Skip);
             CisloRoleF2=str.zfill(str(CisloRole2), int(CISLIC)) # doplnení zleva nulama
             #CisloRoleF2=CisloRoleF2[:(int(CISLIC)-3)]+" "+CisloRoleF2[-3:] #dělení po 3 !!!
             CisloRoleF2=Deleni3(CisloRoleF2)
             self.PoleCislo[k].SetValue(CisloRoleF2);
     def ButtonTA1 (self, JOB):# posun vpřed o  krok
         if JOB=="CD_POP"  or JOB== "CD_Vnitro" or JOB== "CD_Validator": Skip=int(CiselNaRoli)
         elif  JOB== "DPB_AVJ": Skip=1         
         for k in range (0, PROD):
             CisloRoleF=self.PoleCislo[k].GetValue()# načteno z první produkce
             CisloRole=CisloRoleF.replace(" ","")
             CisloRole2=int(CisloRole)-int(Skip);
             CisloRoleF2=str.zfill(str(CisloRole2), int(CISLIC)) # doplnení zleva nulama
             #CisloRoleF2=CisloRoleF2[:(int(CISLIC)-3)]+" "+CisloRoleF2[-3:] #dělení po 3 !!!
             CisloRoleF2=Deleni3(CisloRoleF2)
             self.PoleCislo[k].SetValue(CisloRoleF2);
     def ButtonTA2 (self, JOB):# posun vpřed o 10  kroků
         if JOB=="CD_POP"   or JOB== "CD_Vnitro"  or JOB== "CD_Validator": Skip=int(CiselNaRoli)
         elif  JOB== "DPB_AVJ": Skip=1         
         for k in range (0, PROD):
             CisloRoleF=self.PoleCislo[k].GetValue()# načteno z první produkce
             CisloRole=CisloRoleF.replace(" ","")
             CisloRole2=int(CisloRole)-10*int(Skip);
             CisloRoleF2=str.zfill(str(CisloRole2), int(CISLIC)) # doplnení zleva nulama
             CisloRoleF2=Deleni3(CisloRoleF2)
             self.PoleCislo[k].SetValue(CisloRoleF2);
     def ButtonNahledTXT(self, Adresa):
              webbrowser.open(Cesta) # náhled souborů TXT
              #print (Cesta)
     def ComboBalil1(self, event):
          print (self.ComboBalil.GetValue())
          zamestnanec=self.ComboBalil.GetValue()

######################################
def Kontrola(JOB):
    app = wx.App(False)
    #print ("137 JOB",JOB)
    global frame1
    frame1 = wx.Frame(None, -1, "ROLE", size = (505,750),pos=(0,0)) #velikost plochy  Whole screen 1030,770
    MyPanel(frame1,-1,JOB)
    #MyPanel(Adresa,JOB,Serie,CisloOD,CiselNaRoli)
    frame1.Show(True) # okno formuláře je otevřené
    app.MainLoop()

#Kontrola( "CD_POP")
#Kontrola( "CD_Vnitro")
#Kontrola( "CD_Validator")
#Kontrola( "DPB_AVJ")
#https://www.himeport.co.jp/python/wxpython-wx-colourdatabase%E3%81%AE%E3%82%B5%E3%83%B3%E3%83%97%E3%83%AB%E8%89%B2%E8%A1%A8%E7%A4%BA%E3%83%97%E3%83%AD%E3%82%B0%E3%83%A9%E3%83%A0/
