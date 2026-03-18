#-*- coding: utf-8 -*-
##-*- coding: iso-8859-2 -*-i
#import pdb #debugger
import wx
import os
import string
import time
import csv # create CS
import shelve # ukládání do shelf
import shutil # move file
import xml.etree.ElementTree as ET
import webbrowser # smazat
import Protokoly_NEXGO
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

def CreateXML4(SbL, Adresa1): #  Vznik Settings
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

SetXML4={}
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
    Variab1L=VariablesD[Key]
    VariablesD.close()
    return Variab1L

def DictToShelve(NazevS,Key,ValuesL):
        VariablesD=shelve.open(CWD+"\\"+NazevS)   
        VariablesD[Key] = ValuesL # uložení MinuleD do shelve "VarSettings"
        
def Okno(Nazev): #  wx File Dialog, vyber souboru
    dialog = wx.FileDialog(None, Nazev, style=wx.FD_MULTIPLE | wx.DD_NEW_DIR_BUTTON)
    if dialog.ShowModal() == wx.ID_OK:
        AdresaTXT= dialog.GetPaths() #??????
    dialog.Destroy()
    try:
        #print (len(AdresaTXT), " x  txt:")
        return AdresaTXT    
    except: print ("   !Vyber soubory TXT!")

def Deleni3(line): # dělení čísel po 3 znacích
    i=1;line3=""
    for a in  line[::-1]: 
        if i==3: a=a+" "; i=0
        i=i+1; line3=line3+a
    line4=line3[::-1]  # revers 
    return (line4)
#---#
#def Barva (self, KsVKr, KsN, PROD):
def Barva (self): 
         global cb;  cb=0
         for k in range (0, PROD):
            if self.CB[k].GetValue()==False: #  nezaškrtnutý             
                self.PoleCislo[k].SetSize (180, 40); self.PoleSerie[k].SetSize (46, 41);              
                self.PoleCislo[k].SetBackgroundColour(BarvaPozadi1);  
                self.PoleCislo[k].SetForegroundColour(BarvaTextu2);  
                self.PoleSerie[k].SetBackgroundColour(BarvaPozadi1); 
                self.PoleSerie[k].SetForegroundColour(BarvaTextu2);
                cb=cb+1
            else:
                self.PoleCislo[k].SetSize (181, 40); self.PoleSerie[k].SetSize (47, 40);
                self.PoleCislo[k].SetBackgroundColour(BarvaOkna1); 
                self.PoleCislo[k].SetForegroundColour(BarvaTextu1);  
                self.PoleSerie[k].SetBackgroundColour(BarvaOkna1); 
                self.PoleSerie[k].SetForegroundColour(BarvaTextu1);                     
                 
         if (KsVKr-KsN)<=(PROD-cb): # zaškrtnutý a před naplněním krabice
             #print (KsVKr, KsN, PROD, cb, "KsVKr-KsN+cb", KsVKr-KsN+cb)
             m=KsVKr-KsN
             for k in range (0, PROD):

                 if self.CB[k].GetValue()==True: #  zaškrtnutý
                     if m>0:
                     #if k <(KsVKr-KsN+cb): #poslední krabice 
                        self.PoleCislo[k].SetSize (182, 40); self.PoleSerie[k].SetSize (46, 40);
                        self.PoleCislo[k].SetBackgroundColour(BarvaOkna1); 
                        self.PoleCislo[k].SetForegroundColour("black");  
                        self.PoleSerie[k].SetBackgroundColour(BarvaOkna1); 
                        self.PoleSerie[k].SetForegroundColour("black");
                        m=m-1
                     else:
                         
                        self.PoleCislo[k].SetSize (183, 40); self.PoleSerie[k].SetSize (45, 40);
                        self.PoleCislo[k].SetBackgroundColour(BarvaOkna1); 
                        self.PoleCislo[k].SetForegroundColour("blue");  
                        self.PoleSerie[k].SetBackgroundColour(BarvaOkna1); 
                        self.PoleSerie[k].SetForegroundColour("blue");       
                 else:  pass  # CB nezaškrtnutý               
                     
def RozprcaneKrabice(JOB):# načtení rozdělaných a hotových krabic 
         global Cesta, SerieL, KsN,CisloJizdF,PrvniJizdF, CisloJizd, CISLIC, KsVKr
         ######načtení
         SetXmlL=CteniXML(CWD+"\\FixSettings.xml",JOB)# načtení fixních dat
         Variab1L=ShelveToDict("VarSettings",JOB)# první načtení listu Variables
         Adresa=ShelveToDict("VarSettings","ADRESA") #načtení adresy
         SerieL=Variab1L[1]; SerieS= (",".join(SerieL))
         CISLIC=SetXML[JOB][3] #počet číslic
         KsVKr=int(Variab1L[3].replace(",","")); PROD=int(Variab1L[6].replace(",",""));
         PrvniJizd=int(Variab1L[5].replace(",",""));     
         PrvniJizdF=str("{:,}".format(PrvniJizd)).replace(","," ")     
         CiselNaRoli=SetXmlL[1] # Fixní                                    
        
         ######
         RadekL= [] ;  j=0;
         Cesta=(Adresa+'\\REZANI\\'+JOB+"\\")
         
         CisloJizd1=int(Variab1L[5].replace(",",""))+1; CisloJizd=CisloJizd1 # ZADÁNÍ
         CisloJizdHOT=0; CisloJizdOTV_min=CisloJizd1; CisloJizdOTV_PROD =0# v případě že nejsou rozpracované aní hotové krabice
         VypisL=[]
         for nazev in os.listdir(Cesta): # Zjištění počtu otevřených krabic
             if nazev.count(".txt")==1:  # TXT
                 #print (nazev)
                 with open(Cesta+str(0)+'.txt', "r", encoding="utf-8") as f:  # načtení TXT
                         VypisL=f.readlines()#načtení  obsahu otv. krabic  po řádcích do listu
                 #print ("VypisL...",VypisL)
                 KsN=len(VypisL)
                 #print ("len(VypisL)", len(VypisL))
             else: pass
             if VypisL==[]: # pokud je txt prázdný
                 TXT=open(Cesta+str(0)+'.txt', 'wt') # vytvoření nového TXT
                 KsN=0
                  #print ("114: ", PrvniJizdF)
                  #CisloJizdF=str("{:,}".format(PrvniJizdF)).replace(","," ")
                 CisloJizdF=PrvniJizdF
             else: pass 
 
         Vypis2=os.listdir(Cesta+"\\TXT") #NAČTENÍ POSL ČÍSLA  z HOTOVÝCH KRABIC.
         New=0;TxtLast=0       
         TxtL=[]      
         if  len (Vypis2)>0: # pokud jsou ve složce TXT hotové krabice
                    #print (Vypis2)
                    #print(sorted (Vypis2))             
                    for txt in Vypis2:
                        TxtL.append (txt)
                    TxtL.sort()
                    #print ("posledni",TxtL[-1:])
                    #LastFile=TxtL[5][1] # pátý soubor txt, celá adresa
         else:   CisloJizdHOT=0  
         if CisloJizdHOT==0 and CisloJizdOTV_PROD == 0:
                 CisloJizd=CisloJizd1 # prázdné krabice =nový job
                 DictToShelve("VarSettings","PALETA/DPB_AVJ", [1,1,1,1,1,1]) # nový JOB=Nová paleta
         elif CisloJizdHOT==0 and CisloJizdOTV_PROD > 0: CisloJizd=CisloJizdOTV_PROD # nejsou hotové, ale jsou jen otevřené krab
         elif CisloJizdHOT>0 and CisloJizdOTV_PROD == 0: CisloJizd=BigestNo # nejsou otevřené, ale jsou jen hotové krab
         elif CisloJizdHOT<CisloJizdOTV_PROD: CisloJizd=BigestNo  # jsou hotové i otevřené krab.
         else: CisloJizd=CisloJizdOTV_PROD # nejmenší číslo je v otevřené. krabici
         #print ("   Poslední kus v otevřených  krabicích č.:",CisloJizdOTV_PROD)                   
         #print(); print ("   První nový kus č.:                      ",CisloJizd-1); print()
  
Vyhoz=0; VyhozF=str("{:,}".format(Vyhoz))
RowTxt="";

class MyPanel(wx.Panel):
     def __init__(self, parent,id, JOB):
        wx.Panel.__init__(self, parent, id)
        global BarvaOkna1, Font1, BarvaPozadi1, BarvaTextu1,BarvaTextu2, PROD,CiselNaRoli, NT, SerieS, CKrabNaPalete     
        Font1=(wx.Font(8, wx.SWISS, wx.NORMAL, wx.BOLD, False, u'Verdana')); #self.Text1.SetForegroundColour(wx.Colour(0, 0, 0))
        BarvaOkna1= wx.Colour(255,255,194); BarvaPozadi1=wx.Colour(0, 159, 218);
        BarvaTextu1="black";BarvaTextu2=wx.Colour(0, 129, 210)
        self.SetBackgroundColour(wx.Colour(BarvaPozadi1)) # světlá
        self.SetFont(wx.Font(18, wx.DEFAULT, wx.NORMAL, wx.BOLD,  False, u'Arial'));
        self.SetForegroundColour(BarvaTextu1)
        ############################ NACTENI HODNOT       
        SetXmlL=CteniXML(CWD+"\\FixSettings.xml",JOB)# načtení fixních dat
        Variab1L=ShelveToDict("VarSettings",JOB)# první načtení listu Variables
        #print ("252", Variab1L)
        CKrabNaPalete=0
        #CKrabNaPalete=ShelveToDict("VarSettings","PALETA/" + JOB) #načtení stavu palety
        #print ("207", CKrabNaPalete)
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
        elif JOB=="CD_POP_NEXGO": CiselNaRoli=Variab1L[2]; 
        elif  JOB=="DPB_AVJ":  CiselNaRoli=SetXmlL[1] ; 
        else:pass
        PrvniKrab=int(Variab1L[4])
        ###Načtení počtu hotových krabic
        #CestaTxt=(Adresa+'\\REZANI\\'+JOB+"\\")
        RozprcaneKrabice(JOB)# načtení hodnot z rozpracovaných beden
        PrvniJizd = CisloJizd-1
        PocetTXT = len([f for f in os.listdir(Cesta+"\\TXT") if os.path.isfile(os.path.join(Cesta+"\\TXT", f))])# ! počet TXT ve složce=počet krabic
        #print ("PocetTXT...",PocetTXT)
        #print ("KsN...", KsN)
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
        self.PocetRoli= wx.TextCtrl(name=u'Sfield1', parent=self, pos=wx.Point(xvp3, yvp),size=wx.Size(70,20), style=wx.TE_LEFT,value=str((KsN)) ,validator=wx.DefaultValidator,id=-1);
        self.PocetRoli.SetBackgroundColour(BarvaPozadi1);self.PocetRoli.SetFont(Font1)
        self.PocetRoli.SetToolTip("Počet rolí v otevřených krabicích")
        self.RoliCelkem= wx.TextCtrl(name=u'Sfield1', parent=self, pos=wx.Point(xvp4, yvp),size=wx.Size(70,20), style=wx.TE_LEFT,value=str((KsN)+PocetTXT*KsVKr) ,validator=wx.DefaultValidator,id=-1);
        self.RoliCelkem.SetBackgroundColour(BarvaPozadi1);self.RoliCelkem.SetFont(Font1)            
        xvp=20;   yvp=100
        #self.Box2=wx.StaticBox (self, -1,size=wx.Size(440, 340), pos=wx.Point(xvp-5, yvp), label='')# rámeček

        global CisloJizdFL
        self.CB= []; self.PoleSerie = []; self.PoleCislo= [];  CisloJizdFL= [];    
        global StartCislaL, StartKusy,  StartPalety, Nacteni
        StartCislaL= []; StartKusy= 0; StartPalety= 0;        

        KL= []; 
        for k in range (0, PROD ):# počet produkcí pevný           
            PrvniJizdF= int(("{:0>"+ str(3)+"d}").format(int (PrvniJizd))) 
            PrvniJizdF=str(PrvniJizdF-k*int(CiselNaRoli))
            #print ("335 CisloJizd",CisloJizd)
            PrvniJizdF=str.zfill(str(PrvniJizdF), int(CISLIC))
            CisloJizdFL.insert(k, PrvniJizdF) #PrvniJizd=PrvniRole

            try:#NAČTENÍ MINULÝCH DAT ze Settings.xml
                KL.append(k+1)
                Zapis=((CteniXML4(Cesta+'\\Settings.xml')[SerieL[k]+"_"+str(KL[k])])[0][1])
                ZapisL=str(Zapis).split(",")
                
                if ZapisL[2]!="": CKrabNaPalete=ZapisL[2]# načtení z posledního řádku Settings
                StartCislaL.append(ZapisL[0])
                StartKusy=KsN
            except:
                print ("  Načtení série: ", SerieL[k]); 
                StartKusy=KsN
                #print ("360", StartPaletyL)
                StartCislaL=CisloJizdFL
                #print ("StartCislaL2",StartCislaL)

            # Pole série, číslo a kusy
            yvp=yvp+45 
            self.CB.append (wx.CheckBox(self, label ="",pos = (xvp,yvp+8)))
            self.Bind(wx.EVT_CHECKBOX, self.funkceCheckBox, self.CB[k]); self.CB[k].SetValue(True)
            self.PoleSerie.append( wx.TextCtrl(name=str(k), parent=self, pos=wx.Point(xvp+25, yvp),size=wx.Size(46,40), style=wx.TE_CENTRE,value= str(SerieL[k]) ,validator=wx.DefaultValidator,id=-1))
            self.PoleSerie[k].SetBackgroundColour(BarvaOkna1); self.PoleSerie[k].SetForegroundColour(BarvaTextu1); 
            self.PoleCislo.append( wx.TextCtrl(name=str(k), parent=self, pos=wx.Point(xvp+75, yvp),size=wx.Size(182,40), style=wx.TE_CENTRE,value= str(StartCislaL[k]) ,validator=wx.DefaultValidator,id=-1))
            self.PoleCislo[k].SetForegroundColour(BarvaTextu1);  self.PoleCislo[k].SetBackgroundColour(BarvaOkna1)
            self.PoleCislo[k].SetSize(180,40)
            
        self.PoleKusy2=(wx.TextCtrl(name=str(k), parent=self, pos=wx.Point(xvp+260, yvp), size=wx.Size(92,40), style=wx.TE_CENTRE,value=str(StartKusy)+" ks" ,validator=wx.DefaultValidator,id=-1))
        self.PoleKusy2.SetBackgroundColour(BarvaOkna1);self.PoleKusy2.SetToolTip("Počet rolí v otevřené krabici")
        self.PolePaleta2=(wx.TextCtrl(name=str(k), parent=self, pos=wx.Point(xvp+355, yvp), size=wx.Size(88,40), style=wx.TE_CENTRE,value=str(CKrabNaPalete),validator=wx.DefaultValidator,id=-1))           
        self.PolePaleta2.SetBackgroundColour(BarvaOkna1);self.PolePaleta2.SetToolTip('Počet HOTOVÝCH krabic na paletě \nMožno přepsat podle skutečnosti\n  "-" číslování palet vypnuto')
   
        Barva (self) # změna barvy textu i okna v radku
        
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
        self.ComboBalil=wx.ComboBox(self, -1, value="Vyber jmeno...XX", pos=wx.Point(xvp, yvp), size=wx.Size(177, 25), choices=JmenaL, style=0,  name="Balil")
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
           #print (NT)
           #print ("   Tisk výstup: ", self.Sestava.GetCheckedStrings())
 
     def TiskTXT(self,Cesta,JOB): # Tisk z adresáře
         print ('  Vyber soubory k tisku protokolu \n"SHIFT" = více souborů')
         CestaTxtL=(Okno(Cesta+"\TXT")) #  LIst vybraných adres TXT
         
         BALIL=self.ComboBalil.GetValue(); # V případě rozdělaných krabic není balič
         if BALIL=="Vyber jmeno...XX":
             print ("   !Vyber jmeno baliče!")
             ctypes.windll.user32.MessageBoxW(0, "Vyber jméno baliče", "Warning message", 1)
         else:  Protokoly_NEXGO.Ulozeni_PDF(CestaTxtL, Cesta,JOB, BALIL, NT,"PRINT") # 
         #Protokoly.Ulozeni_PDF(CestaTxtL, Cesta,JOB, NT) # return CISLO
         #print (Protokoly_NEXGO.Ulozeni_PDF_A5A6(CestaTxtL, Cesta)) #LIst vybraných adres PDF
         #print ("324....",CestaTxtL, CestaTxtL, Cesta,JOB, BALIL, NT,"PRINT")

     def Seznam(self,Cesta,JOB): # Seznam pro ČD
            print ("pro tento job není funkce Seznam dostupná") # jen pro Vnitro a Validátory

     def funkceCheckBox(self, event):
         Barva (self) #změny barev textu


     def cbTurbo1(self,event):
              if self.CBTurbo.GetValue()==True: print ("  Po krabicích")
              else: pass
              #Turbo= (event.GetEventObject().GetLabel()) 
              #print (Turbo)
              
     global CestaTxtL; CestaTxtL=[]; 
     def ButtonOK(self, JOB):
        """OtevreneKrabice=1 # počet otevřených krabic čekajících na protokol
        if len (CestaTxtL)==OtevreneKrabice: CestaTxtL.clear() # pro jistotu znovu
        else: pass   """
        #RowpolD={} #import HTMLProtokol
        global Vyhoz,KsN,RowTxt, CKrabNaPalete 
        #print ("634...",CKrabNaPalete)
        SetXmlL=CteniXML(CWD+"\\FixSettings.xml",JOB)# načtení fixních dat
        Variab1L=ShelveToDict("VarSettings",JOB)# načtení variabilních dat
        Variab1L=ShelveToDict("VarSettings",JOB)# první načtení listu Variables
        Adresa=ShelveToDict("VarSettings","ADRESA") #načtení adresy
        #Palety=ShelveToDict("VarSettings","PALETA/" + JOB) #načtení stavu palety
        KsVKr=int(Variab1L[3].replace(",","")); PROD=int(Variab1L[6].replace(",",""));
        PrvniJizd=int(Variab1L[5].replace(",","")); PrvniJizdF=str("{:,}".format(PrvniJizd)).replace(","," ");
        PrvniKrab=int(Variab1L[4])
        #CISLIC=SetXML[JOB][3] #počet číslic
        Balil=self.ComboBalil.GetValue();
        #CSV= open(Adresa+'\\REZANI\\'+JOB+"\\CSV\\"+str(PrvniJizd)+'.csv', 'a', newline='') # vznik csv
        #try: zaznam = csv.writer(CSV)
        #except: pass
        #zaznam.writerow(["Krabice;Paleta;Serie OD-DO;čas uložení"])
        if Balil=="Vyber jmeno...": # 
            print ("!   Vyber jméno baliče  !")
            Balil = "..............................."
            ctypes.windll.user32.MessageBoxW(0, "Vyber jméno baliče", "Warning message", 1)
        else:     
            CiselNaRoli=Variab1L[2]; 
            ###přidat konec krabice
            #print ("KsVKr", KsVKr, "KsN", KsN, "PROD",PROD)
            if self.CBTurbo.GetValue()==True:
                self.CBTurbo.SetValue(False) # vypnutí turbo
                Cyklus=KsVKr  # maximální možné číslo přerušené break
                i=0; 
            else:
                Cyklus=1; #po 1 výhozu, bez Turbo
                i=0;   
            CisloRoleFL=[]; KoncCisloRoleL=[];  RowCsv=""; VypisL2=[];
            #for i in range (0,Cyklus): # počet ks v krab
            ZapisVcmd=""; ZapisVcmdL=[]
            while i<Cyklus:  # buď po výhozu a nebo po celé krabici  s funkcí break
                i=i+1
                Vyhoz=Vyhoz +1;  VyhozF=str("{:,}".format(Vyhoz)) # dělení čísel po třech
                #print ("Vyhoz:", Vyhoz) # Vyhoz               
                self.Vyhoz.SetValue(VyhozF) # zápis do pole Výhoz
                RowCsv=str(Vyhoz) +";"
                Krab="open";
                for k in range (0, PROD):  # Range je 1 až X-1 !
                   if Cyklus==KsVKr and  k==0: ZapisVcmd=ZapisVcmd+"\n"
                   #self.PoleKusy1.SetForegroundColour("black"); self.PoleKusy1.SetSize (86, 40)
                   self.PoleKusy2.SetForegroundColour(BarvaTextu1); self.PoleKusy2.SetSize (91, 40)
                   if self.CB[k].GetValue()==True: self.PoleCislo[k].SetForegroundColour(BarvaTextu1); self.PoleCislo[k].SetSize (182, 40)      
                   else:self.PoleCislo[k].SetForegroundColour(BarvaTextu2) ; self.PoleCislo[k].SetSize (181, 40)  
                   CisloRoleF=self.PoleCislo[k].GetValue();CisloRole=int(CisloRoleF.replace(" ","")) # načteno z  polí
                   SerieL[k]=self.PoleSerie[k].GetValue() # načtení skutečných serií

                   if self.CB[k].GetValue()==True: # if Checkbox u serie  zaškrtnutý
                      #self.PoleKusy1.SetForegroundColour("black");     
                      with open(Cesta+str(0)+".txt", "r", encoding="utf-8") as f:  # načtení KS z rozdělaných TXT
                                     VypisL=f.readlines() #načtení  obsahu rozděl. TXT po řádcích do listu
                      RadekL= []                      
                      for radek in VypisL: 
                           if radek.count ("|")>=3: # vytřídění bordelu 
                               RadekL.append(radek)

                      #print (" 655..VypisL",VypisL)                 
                      KoncCisloRole =int(CisloRole)-int(CiselNaRoli)+1                      
                      KoncCisloRole=str.zfill(str(KoncCisloRole), int(CISLIC)) # doplnení zleva nulama
                      KoncCisloRole=Deleni3(KoncCisloRole)
                      #print ("KoncCisloRole", KoncCisloRole)
              
                      if int(CisloRole)<1:
                          print ("!   Konec  !")
                          return                     
                      else: pass

                      if KsVKr-KsN>0: #nenaplněná krabice
                          Ks=("{:0>2d}".format(KsVKr-KsN))# to formátování je pouze pro zápis do TXT                  
                          RowTxt=Ks+"|"+SerieL[k] +"|"+str(KoncCisloRole) +"|"+str (CisloRoleF)+"\n"   #  záznam do TXT 
                          #print (" 704....RowTxt:", RowTxt)
                          KsN=KsN+1    # přidání kusu do  krabice
                          #print ("669_KsN", KsN)
                                  
                          with open(Cesta+str(0)+'.txt', 'a',encoding="utf-8") as f:   #                       
                                     f.write(RowTxt) # další záznam  # přidání do krabic                            
                                     #print ("  "+SerieL[k] +"  "+str(KoncCisloRole)+" - "+str (CisloRoleF));
                                     #ZapisVcmd=ZapisVcmd+"-"+str(KoncCisloRole)# jen kvůli zobrazení v ZapisVcmd
                                     ZapisVcmdL.append(str(KoncCisloRole))
                                     ZapisVcmdL.reverse()

                          #print (self.PoleKusy1.GetValue())           
                          if Krab=="closed": self.PoleCislo[k].SetForegroundColour("blue"); self.PoleCislo[k].SetSize (180, 40)
                          Krab="new"

                      else: #naplněná krabice
                              #print ("Plna krabice")
                              KsN=0
                              Ks=("{:0>2d}".format(KsVKr-KsN))# to formátování je pouze pro zápis do TXT                  
                              RowTxt=Ks+"|"+SerieL[k] +"|"+str(KoncCisloRole) +"|"+str (CisloRoleF)+"\n"   #  záznam do TXT                           
                              KsN=KsN+1                    
                              named_tuple = time.localtime() # čas
                              Time=time_string = time.strftime("%m/%d/%Y, %H:%M:%S", named_tuple) #formát času                          
                              PocetTXT = len([f for f in os.listdir(Cesta+"\\TXT") if os.path.isfile(os.path.join(Cesta+"\\TXT", f))])# ! počet TXT ve složce=počet krabic
                              cisl=str(PocetTXT+1).replace(" ","")
                              if CKrabNaPalete !="-":    
                                 with open(Cesta+str(0)+'.txt', 'a',encoding="utf-8") as f:                    
                                     f.write("\nJOB: "+JOB+"\nCISLO_KRABICE: "+cisl+"\nPRODUKCE: "+str(PROD)+"\nC_KRAB_NA_PALETE: "+str(int(CKrabNaPalete)+1)+"\nMNOZSTVI: "+str(KsVKr)+" ks"+ "\nBALIL: "+ Balil+"CAS: "+ Time)# doplnění  záznamu o čas, balil...                                                               
                              else:
                                 with open(Cesta+str(0)+'.txt', 'a',encoding="utf-8") as f:                    
                                     f.write("\nJOB: "+JOB+"\nCISLO_KRABICE: "+cisl+"\nPRODUKCE: "+str(PROD)+"\nC_KRAB_NA_PALETE: "+" "+"\nMNOZSTVI: "+str(KsVKr)+" ks"+ "\nBALIL: "+ Balil+"CAS: "+ Time)# doplnění  záznamu o čas, balil...                                                               
                                    
                              self.Krabice.SetValue(str(PocetTXT+1))# zvýšení čísla krabice
                              shutil.move(Cesta+str(0) +'.txt', Cesta+"\\TXT\\"+str(PocetTXT+1) +"_"+SerieL[k]+'.txt', copy_function = shutil.copytree)
                              # přehození do adresáře TXT
                              with open(Cesta+str(0)+'.txt', 'a',encoding="utf-8") as f:     # zapis do novýho                      
                                     f.write(RowTxt) # první záznam
                                     #print ("BL ", cisl), 
                                     #ZapisVcmd=ZapisVcmd+"\n\n  Tisk BL: "+cisl+"\n\n-"+str(KoncCisloRole) # jen z dův zobrazení v ZapisVcmd
                              Krab="closed"
                              CestaTxt=Cesta+"\\TXT\\"+cisl+"_"+SerieL[k]+'.txt' #
                              
                   if Krab=="closed":
                      ZapisVcmdL.reverse()
                      print ("\nTisk BL\n")
                      ZapisVcmdL.append(str(KoncCisloRole))
                      #print(ZapisVcmdL)  # zápis do CMD
                      #ZapisVcmdL = []
                      self.PoleKusy2.SetValue(str(KsN)+" ks")
                      CKrabNaPalete=self.PolePaleta2.GetValue()
                      #print ("Cyklus ",Cyklus )
                      if CKrabNaPalete != "-":
                          CKrabNaPalete=int(CKrabNaPalete)+1
                      else: print ("  Vypnuto čislování krabic na pal.")
                      #print ("CKrabNaPalete",CKrabNaPalete) 
                      self.PolePaleta2.SetValue(str(CKrabNaPalete))
                      CestaTxtL.append(CestaTxt)#List TXT k náhledu a tisku
                   else: 
                      self.PoleKusy2.SetValue(str(KsN)+" ks");  
                   Skip=int(CiselNaRoli)*PROD
                   CisloRole2=int(CisloRole)-Skip
                   CisloRole2=str.zfill(str(CisloRole2), int(CISLIC))
                   CisloRole2=Deleni3(CisloRole2)
                   #print ("CisloRole2", CisloRole2)
                   self.PoleCislo[k].SetValue(CisloRole2);


                self.PocetRoli.SetValue(str((KsN)))# Aktuální počet rolí
                RolivKrab=int(self.Krabice.GetValue())*KsVKr;   self.RoliCelkem.SetValue(str((KsN)+RolivKrab))                     
                       
                #zaznam = csv.writer(CSV) 
                #Row=str(Vyhoz-1)+";"+SerieS+";"+str(CisloRole)
                #print("455", CestaTxtL, Cesta, JOB,NT)
                BALIL=""# pro neuplnou krabici.  V příp. úplné se načte z TXT
                #print  ("OtevreneKrabice", OtevreneKrabice)
                #ZapisVcmdL.reverse() # otočení listu
                print (ZapisVcmdL)
                ZapisVcmdL = []
                if KsVKr-KsN<PROD: break
            if len (CestaTxtL)==1: # počet otevřených krabic bez BL a ST
                DictToShelve("VarSettings","PALETA/"+JOB, CKrabNaPalete)
                Protokoly_NEXGO.Ulozeni_PDF(CestaTxtL,Cesta, JOB,BALIL,NT,"OK") # Create PDF + Uložení
                #for i in range (1,1000000):  i=i+1 # vyhodit. Jen zdržení
                #print ("BL ", cisl), print ()
                #print ("Ulozeni_PDF(",CestaTxtL,",'"+Cesta+"','"+JOB+"','"+BALIL+"',",NT,",",'OK',")")
                CestaTxtL.clear()
            Barva (self) # změna barvy textu i okna v radku
          
            SD={}; i=0; NestedL=[] ;KL= []
   
            #print (ZapisVcmd)

            for k in range (0, PROD): #zápis posl. stavu do XML
                    NestedL.append([])
                    KL.append(k+1)
                    #for j in  [SerieL[k], "self.PoleCislo[k].GetValue()","Text"]:
                    #for j in ["prod_"+str(k+1), SerieL[k], (self.PoleCislo[k].GetValue(), self.PoleKusy1[k].GetValue() )]:
                    for j in [SerieL[k] +"_"+str(KL[k]), self.PoleCislo[k].GetValue()+","+self.PoleKusy2.GetValue()+","+ self.PolePaleta2.GetValue(), " "+str(k+1)+". prod."]:
                         NestedL[k].append(j)
            SD=([{"cisla_od": NestedL},{"balil":[("jmeno",self.ComboBalil.GetValue(),"vyst_kontrola")]}])      

            CreateXML4(SD, Cesta+'\\Settings.xml')

     def ButtonZP1(self, JOB): #zpětný posun o 1 krok
         Skip=int(CiselNaRoli)*PROD
         for k in range (0, PROD):
             CisloRoleF=self.PoleCislo[k].GetValue()# načteno z první produkce
             CisloRole=CisloRoleF.replace(" ","")
             CisloRole2=int(CisloRole)+int(Skip);
             CisloRoleF2=str.zfill(str(CisloRole2), int(CISLIC)) # doplnení zleva nulama
             CisloRoleF2=Deleni3(CisloRoleF2)
             #CisloRoleF2=str("{:,}".format(CisloRole2)).replace(","," ");
             self.PoleCislo[k].SetValue(CisloRoleF2);
     def ButtonZP2(self, JOB):#zpětný posun o 10 kroků
         Skip=int(CiselNaRoli)*PROD       
         for k in range (0, PROD):
             CisloRoleF=self.PoleCislo[k].GetValue()# 
             CisloRole=CisloRoleF.replace(" ","")
             CisloRole2=int(CisloRole)+10*int(Skip);
             CisloRoleF2=str.zfill(str(CisloRole2), int(CISLIC)) # doplnení zleva nulama
             #CisloRoleF2=CisloRoleF2[:(int(CISLIC)-3)]+" "+CisloRoleF2[-3:] #dělení po 3 !!!
             CisloRoleF2=Deleni3(CisloRoleF2)
             self.PoleCislo[k].SetValue(CisloRoleF2);
     def ButtonTA1 (self, JOB):# posun vpřed o  krok
         Skip=int(CiselNaRoli)*PROD 
         for k in range (0, PROD):
             CisloRoleF=self.PoleCislo[k].GetValue()# načteno z první produkce
             CisloRole=CisloRoleF.replace(" ","")
             CisloRole2=int(CisloRole)-int(Skip);
             CisloRoleF2=str.zfill(str(CisloRole2), int(CISLIC)) # doplnení zleva nulama
             #CisloRoleF2=CisloRoleF2[:(int(CISLIC)-3)]+" "+CisloRoleF2[-3:] #dělení po 3 !!!
             CisloRoleF2=Deleni3(CisloRoleF2)
             self.PoleCislo[k].SetValue(CisloRoleF2);
     def ButtonTA2 (self, JOB):# posun vpřed o 10  kroků
         Skip=int(CiselNaRoli)*PROD 
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
    
#Kontrola( "CD_POP_NEXGO")
#https://www.himeport.co.jp/python/wxpython-wx-colourdatabase%E3%81%AE%E3%82%B5%E3%83%B3%E3%83%97%E3%83%AB%E8%89%B2%E8%A1%A8%E7%A4%BA%E3%83%97%E3%83%AD%E3%82%B0%E3%83%A9%E3%83%A0/*